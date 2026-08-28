# BountyFlow Pro

A production-oriented decentralized bounty marketplace built on **Stellar Soroban**.
Creators post bounties and escrow real XLM on-chain; developers claim, deliver,
and get paid automatically the moment their work is approved — no custodian,
no IOU, no manual payout step.

This is the **Level 3** evolution of the original BountyFlow project. Where
Level 2 tracked a reward amount as a number, BountyFlow Pro actually moves
XLM through Soroban contracts on Stellar Testnet.

> **Status:** all contracts, scripts, and frontend code in this repository
> are implemented and internally consistent, but nothing has been deployed
> yet. Every "deployed contract ID" / "live demo" / "screenshot" placeholder
> below is exactly that — a placeholder — until you run the deployment
> pipeline yourself. See [Contract Deployment](#contract-deployment).

---

## Table of Contents

- [Level 3 Scope](#level-3-scope)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contract Architecture](#smart-contract-architecture)
- [Inter-Contract Communication](#inter-contract-communication)
- [Escrow / Payment Flow](#escrow--payment-flow)
- [Event Flow](#event-flow)
- [Transaction Lifecycle](#transaction-lifecycle)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Contract Deployment](#contract-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Security Considerations](#security-considerations)
- [Screenshots](#screenshots)
- [Deployed Contracts](#deployed-contracts)
- [Sample Transaction](#sample-transaction)
- [Live Demo](#live-demo)
- [Demo Video](#demo-video)

---

## Level 3 Scope

This project demonstrates, concretely and not just by description:

1. Advanced Soroban smart contract development (state machines, typed
   errors, events, TTL management, cross-contract deployment).
2. Genuine inter-contract communication — a factory that deploys and
   initializes independent bounty/escrow contract instances.
3. Event streaming and real-time UI updates without page reloads.
4. CI/CD via GitHub Actions (contract tests, frontend tests, lint, build).
5. A reproducible, script-driven deployment workflow.
6. A mobile-responsive Next.js frontend.
7. Explicit loading, empty, and error states throughout.
8. A meaningful smart contract test suite.
9. A meaningful frontend test suite.
10. A clean, production-shaped project structure with no unnecessary
    backend services or databases.

## Features

**Creator**
- Connect a supported Stellar wallet.
- Create a bounty (title, description, XLM reward).
- Deposit the reward into on-chain escrow.
- View bounties they've created.
- Review submitted work.
- Approve completed work — this releases escrowed XLM to the developer
  atomically, in the same transaction.
- Cancel/refund a bounty while it's unclaimed, or after a claim-timeout
  window elapses without a submission.

**Developer**
- Browse open bounties.
- Claim an open bounty.
- Submit completed work (description + optional link).
- Track claimed/submitted/completed bounties.
- Receive the escrowed reward automatically on creator approval.

**Lifecycle**

```
CREATE → FUND ESCROW → OPEN → CLAIMED → SUBMITTED → APPROVED → REWARD RELEASED → COMPLETED
                                    │
                                    └──────────────→ CANCELLED → REFUNDED
```

## Architecture

Two Soroban contracts, one Next.js frontend, no additional backend service
or database — the chain is the backend.

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Next.js Frontend    │◄──────►│     Soroban RPC (testnet)  │
│  (wallet, UI, events) │        └──────────────┬─────────────┘
└──────────┬───────────┘                        │
           │ invoke                             │
           ▼                                    ▼
┌─────────────────────┐   deploy+init   ┌──────────────────────┐
│   Factory Contract    │────────────────►│  Bounty Contract #N   │
│  registry of bounties │                 │ (one per bounty,       │
└─────────────────────┘                 │  holds its own escrow) │
                                          └──────────┬────────────┘
                                                      │ token.transfer
                                                      ▼
                                          ┌──────────────────────┐
                                          │  Native XLM SAC token  │
                                          └──────────────────────┘
```

A backend service and database were deliberately **not** added. The
factory's on-chain registry plus per-bounty contract reads are sufficient
for bounty discovery at this scale, and adding an indexer would introduce a
second source of truth the contracts would have to be reconciled against —
exactly the kind of over-engineering the Level 3 brief asks to avoid.

## Smart Contract Architecture

**`factory`** — `contracts/factory`
- Holds the installed WASM hash of the `bounty` contract and the token
  (native XLM SAC) address bounties are denominated in.
- `create_bounty(...)` deploys a brand-new `bounty` contract instance via
  Soroban's native contract deployer and initializes it with a
  cross-contract call — see [Inter-Contract Communication](#inter-contract-communication).
- Maintains a registry: bounty id → contract address, and creator →
  bounty ids, so the frontend can discover bounties without an indexer.
- `set_wasm_hash` lets the admin point new bounties at upgraded code
  without touching already-deployed bounty instances (see
  [Updating a deployed contract](#updating-a-deployed-contract)).

**`bounty`** — `contracts/bounty`
- One instance per bounty. Its own contract address **is** the escrow —
  the SAC token balance of `env.current_contract_address()` is the held
  reward, not a number in a struct.
- Enforces every business rule on-chain (see below), never in the frontend.
- State machine: `Created → Open → Claimed → Submitted → Released`, with
  `Refunded` reachable from `Created`/`Open` at any time, or from `Claimed`
  once `claim_timeout_secs` has elapsed without a submission.

This factory → per-bounty-instance shape was chosen over a single
monolithic "all bounties in one contract" design because:
- Escrow isolation: a bug or exploit affecting one bounty's logic cannot
  touch another bounty's already-escrowed funds, since each bounty has its
  own contract address and its own token balance.
- It's the natural place to demonstrate genuine Soroban inter-contract
  calls, rather than adding a second contract that doesn't need to exist.

### On-chain business rules

All enforced in `contracts/bounty/src/lib.rs`, verified in
`contracts/bounty/src/test.rs`:

| Rule | Enforcement |
|---|---|
| Creator authorization | `creator.require_auth()` on `fund`, `approve`, `cancel` |
| Claimant authorization | `claimant.require_auth()` on `claim`, `submit`; caller must match stored claimant |
| Cannot claim an already-claimed bounty | `claim` requires `status == Open` |
| Cannot submit unless caller is the claimant | `submit` checks `claimant == caller` |
| Cannot approve unless caller is the creator | `approve` authorizes the *stored* creator address, not whoever calls |
| Cannot release the reward twice | status flips to `Released` before the token transfer (checks-effects-interactions); `approve` requires `status == Submitted` |
| Cannot withdraw escrow incorrectly | only `approve` (→ claimant) and `cancel` (→ creator, rule-gated) ever move funds out |
| Cannot create invalid rewards | `init` and `create_bounty` require `reward > 0` |
| Correct state transitions | every method checks the exact required prior status and panics otherwise |
| Correct refund handling | `cancel` is only refundable while `Open`, or while `Claimed` past the timeout; never after `Submitted` |

## Inter-Contract Communication

The project's genuine cross-contract interaction happens in
`FactoryContract::create_bounty`:

```rust
// 1. Deploy a brand-new bounty contract instance from the stored WASM hash.
let deployed_address = env
    .deployer()
    .with_current_contract(salt)
    .deploy_v2(wasm_hash, ());

// 2. Cross-contract call into the freshly deployed instance to configure it.
let bounty_client = BountyContractClient::new(&env, &deployed_address);
bounty_client.init(&env.current_contract_address(), &creator, &token, &title, &description, &reward, &claim_timeout_secs);
```

A second, independent inter-contract relationship exists inside every
`bounty` instance: `fund`, `approve`, and `cancel` all call into the
**native XLM Stellar Asset Contract** through `soroban_sdk::token::Client`
to actually move funds:

```rust
let token_client = token::Client::new(&env, &data.token);
token_client.transfer(&data.creator, &contract_addr, &data.reward); // fund()
token_client.transfer(&contract_addr, &claimant, &data.reward);     // approve()
token_client.transfer(&contract_addr, &data.creator, &data.reward); // cancel()
```

Both relationships are documented in code comments at their call sites in
`contracts/factory/src/lib.rs` and `contracts/bounty/src/lib.rs`.

## Escrow / Payment Flow

```
Creator calls factory.create_bounty()
   → factory deploys + initializes a new bounty contract        (Status: Created)
Creator calls bounty.fund()
   → token.transfer(creator → bounty contract)                  (Status: Open)
Developer calls bounty.claim()                                  (Status: Claimed)
Developer calls bounty.submit()                                 (Status: Submitted)
Creator calls bounty.approve()
   → status flips to Released BEFORE the transfer (no re-entrant double pay)
   → token.transfer(bounty contract → developer)                (Status: Released)
```

Cancellation branch:

```
Creator calls bounty.cancel()     [only while Open, or Claimed past timeout]
   → status flips to Refunded BEFORE the transfer
   → token.transfer(bounty contract → creator)                  (Status: Refunded)
```

Because the reward lives in the bounty contract's own SAC token balance,
"the reward is escrowed" is a verifiable on-chain fact — checkable directly
via `stellar contract invoke ... -- get_bounty` or by reading the token
contract's balance for that address — not a claim the frontend makes.

## Event Flow

Both contracts publish typed events (`#[contractevent]`) for every
state-changing action: `BountyCreated`, `BountyFunded`, `BountyClaimed`,
`WorkSubmitted`, `BountyApproved`, `RewardReleased`, `BountyRefunded`.

The frontend (`frontend/src/lib/events.ts`) polls Soroban RPC's
`getEvents` on a fixed interval, scoped to the factory contract plus any
bounty contracts currently relevant to the page:

- **Dedup:** every event is keyed by `${ledger}:${eventId}` and tracked in
  a `Set`, so a poll overlap never delivers the same event twice.
- **No leaks:** the poller's `setTimeout` handle is captured and cleared in
  the `stop()` returned to `useBountyEvents`, which is called from a
  `useEffect` cleanup — exactly one interval is ever alive per mounted
  consumer.
- **Bounded RPC usage:** a 6-second interval, a 20-ledger lookback on first
  mount, and a hard cap of 50 events per poll keep this from turning into
  an unbounded polling loop.
- **No excessive logging:** there is no unconditional `console.log` in the
  event path; errors are surfaced through `onError` callbacks instead.

Blockchain state and UI state are explicitly separate: `useBounties` caches
what the chain reported the last time it was asked, `useBountyEvents`
independently reports *that something changed*, and it's the caller's
responsibility to re-fetch (`refreshOne`) — the event stream itself never
becomes the source of truth for bounty status.

## Transaction Lifecycle

`frontend/src/lib/soroban.ts` exposes `invokeContract`, which reports each
distinct phase through an `onState` callback and is the single place a
transaction's state is ever set:

```
preparing → simulating → awaiting-wallet → submitted → confirming → success
                                                              └──────→ error
```

- **Submission ≠ confirmation.** `submitted` fires the instant
  `sendTransaction` returns a hash; `success` fires only once
  `getTransaction` reports `SUCCESS`. The transaction hash is exposed to
  the UI as soon as it exists, before confirmation.
- **No artificially fast polling.** Confirmation polls at a fixed 2s
  interval up to a 60s timeout — reflecting real ledger close time, not
  shortened to make the UI feel snappier.
- **Duplicate-action protection.** `useTransaction` (`frontend/src/hooks/useTransaction.ts`)
  tracks an in-flight ref and no-ops on a second `run()` call while busy.
- **Reload recovery.** Every page that shows contract state re-fetches it
  directly from chain on mount (`getBounty`, `getBountyAddress`, etc.)
  rather than trusting anything cached client-side, so a reload mid-flow
  always renders whatever the contract actually recorded — a stale "Claim"
  button simply won't appear once the chain shows `Claimed`.

## Technology Stack

| Layer | Choice |
|---|---|
| Smart contracts | Rust + `soroban-sdk` 21.x |
| Chain | Stellar Soroban, Testnet |
| Reward asset | Native XLM via the Stellar Asset Contract (SAC) |
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Wallets | Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`) |
| Chain client | `@stellar/stellar-sdk` |
| Contract tests | `cargo test` with `soroban-sdk` testutils |
| Frontend tests | Vitest + Testing Library |
| CI/CD | GitHub Actions |
| Deploy scripting | PowerShell (Windows-first, per project requirements) |

## Folder Structure

```
BountyFlow-Pro/
├── contracts/
│   ├── Cargo.toml                # workspace
│   ├── factory/
│   │   ├── Cargo.toml
│   │   └── src/{lib.rs, test.rs}
│   └── bounty/
│       ├── Cargo.toml
│       └── src/{lib.rs, test.rs}
├── scripts/                      # PowerShell, Windows-compatible
│   ├── build.ps1
│   ├── test.ps1
│   ├── deploy.ps1
│   ├── configure-frontend.ps1
│   └── deploy-all.ps1
├── frontend/
│   ├── src/
│   │   ├── app/                  # pages (board, create, bounty/[id], dashboards)
│   │   ├── components/           # Navbar, WalletButton, TxStatusBanner, cards, skeletons...
│   │   ├── hooks/                # useWallet, useTransaction, useBounties, useBountyEvents
│   │   ├── lib/                  # wallet.ts, soroban.ts, events.ts, errors.ts, format.ts
│   │   │   └── contracts/        # factory.ts, bounty.ts typed client wrappers
│   │   └── types/
│   ├── tests/                    # Vitest suite
│   └── package.json
├── deployments/                  # deploy.ps1 output (gitignored, .gitkeep tracked)
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-contracts.yml
├── docs/screenshots/              # placeholders — see Screenshots section
├── .env.example
└── README.md
```

## Local Setup

Prerequisites: [Rust](https://rustup.rs/) with the `wasm32-unknown-unknown`
target, [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli),
Node.js 20+, and a Stellar wallet browser extension (e.g. Freighter) for
manual testing. All commands below are PowerShell.

```powershell
git clone <this-repo>
cd BountyFlow-Pro

# Contracts
cd contracts
rustup target add wasm32-unknown-unknown
cd ..

# Frontend
cd frontend
npm install
cd ..
```

Then follow [Contract Deployment](#contract-deployment) to get a working
`frontend/.env.local`, and run the frontend:

```powershell
cd frontend
npm run dev
```

## Environment Variables

Kept consistent by name across all three places they're used:

| Variable | Local (`frontend/.env.local`) | GitHub Actions | Vercel |
|---|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | ✓ (auto-written) | ✓ (CI build placeholder) | ✓ (set manually) |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ID` | ✓ | ✓ (placeholder) | ✓ (real value after deploy) |
| `NEXT_PUBLIC_TOKEN_CONTRACT_ID` | ✓ | ✓ (placeholder) | ✓ |
| `NEXT_PUBLIC_DEFAULT_CLAIM_TIMEOUT_SECS` | ✓ | ✓ | ✓ |
| `DEPLOYER_SECRET_KEY` | n/a (local uses `stellar keys`) | ✓ (Actions secret, never a variable) | n/a |

See `frontend/.env.local.example` for the exact template and
`.env.example` at the repo root for where each file lives and why they're
kept separate — no secret key is ever stored in a `NEXT_PUBLIC_*` variable
or committed to the repository.

## Contract Deployment

Deployment is fully scripted; nobody should ever need to hand-copy a WASM
hash or contract ID. All commands are PowerShell — no Bash line
continuations, per the project's Windows-first requirement.

```powershell
# One command, start to finish:
./scripts/deploy-all.ps1 -IdentityName bountyflow-deployer -Network testnet

# Or step by step:
./scripts/build.ps1
./scripts/test.ps1
./scripts/deploy.ps1 -IdentityName bountyflow-deployer -Network testnet
./scripts/configure-frontend.ps1 -Network testnet
```

What each step does:

1. **`build.ps1`** — compiles both contracts to WASM and runs
   `stellar contract optimize`.
2. **`test.ps1`** — builds `bounty` to WASM first (the factory's tests
   deploy real bounty WASM, not the Rust struct directly), then runs
   `cargo test --workspace`.
3. **`deploy.ps1`** — funds/reuses a named identity via friendbot, resolves
   the network's native XLM SAC address, installs the bounty WASM,
   deploys the factory contract, initializes it, and writes a timestamped
   JSON record to `deployments/` plus `deployments/latest.json`.
4. **`configure-frontend.ps1`** — reads `deployments/latest.json` and
   writes `frontend/.env.local` with the correct RPC URL, passphrase, and
   contract IDs for that network.

### Updating a deployed contract

Changing Rust source does **not** update an already-deployed contract.
To ship a change:

```powershell
./scripts/build.ps1                       # rebuild WASM from new source
stellar contract install `
  --wasm target/wasm32-unknown-unknown/release/bounty.optimized.wasm `
  --source bountyflow-deployer `
  --network testnet                        # install the NEW wasm, get a NEW hash
stellar contract invoke `
  --id <factory-contract-id> `
  --source bountyflow-deployer `
  --network testnet `
  -- set_wasm_hash --new_hash <new-hash>    # point the factory at it
```

Existing bounty instances keep running their original code — only bounties
created after `set_wasm_hash` use the new version. This is intentional:
mid-flight escrowed funds should never be affected by an unrelated code
upgrade.

## Frontend Deployment

The frontend deploys cleanly to Vercel:

1. Import the repository, set the **root directory** to `frontend/`.
2. Add the `NEXT_PUBLIC_*` environment variables listed above (copy values
   from `frontend/.env.local` after running the deploy scripts).
3. Deploy. Vercel's Next.js preset requires no additional build
   configuration.

## Testing

**Contracts** (`contracts/`):

```powershell
./scripts/test.ps1
```

Covers bounty creation, authorization (creator/claimant), valid and invalid
claiming, work submission, approval + reward release, refund/cancellation
(including the claim-timeout path), preventing double payment, invalid
state transitions, and rejecting non-positive rewards — 10 tests in
`contracts/bounty/src/test.rs`, 4 in `contracts/factory/src/test.rs`
covering real cross-contract deployment.

**Frontend** (`frontend/`):

```powershell
cd frontend
npm run test
```

Covers amount formatting/validation (including the "no scientific
notation" and "insufficient balance" requirements), wallet/contract error
humanization (including the "never expose raw SDK errors" requirement),
bounty card and status badge rendering, the transaction status banner's
full phase set (submission distinctly rendered from confirmation), and the
`useTransaction` hook's duplicate-submission guard.

Both suites produce well over 3 passing tests, per the Level 3 minimum.

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

- **contracts job:** installs Rust + the Stellar CLI, builds `bounty` to
  WASM, runs `cargo test --workspace`, `cargo fmt --check`, and
  `cargo clippy -D warnings`.
- **frontend job:** `npm ci`, `npm run lint`, `npm run typecheck`,
  `npm run test`, `npm run build`.

`.github/workflows/deploy-contracts.yml` is manually triggered
(`workflow_dispatch`) with a network selector, and mirrors `deploy.ps1`
exactly: build → test → install → deploy → initialize → upload the
deployment record as a build artifact. It reads the deployer's secret key
from a GitHub Actions **secret** (`DEPLOYER_SECRET_KEY`), never a plain
environment variable, and never commits it or any output back to the repo.

## Security Considerations

- **All authorization is on-chain.** Every privileged action calls
  `require_auth()` on the address stored at bounty-creation time, not on
  whichever address happens to call the function. Frontend role checks
  (`isCreator`, `isClaimant`) are UX conveniences only.
- **Checks-effects-interactions.** `approve` and `cancel` flip the bounty's
  status in storage *before* calling `token.transfer`, so even if a
  malicious token implementation attempted re-entrancy, the guard condition
  (`status == Submitted` / refundable) would already have flipped and the
  second call would fail.
- **No privileged escrow bypass.** Only `approve` (pays the claimant) and
  `cancel` (refunds the creator, rule-gated) ever move funds out of a
  bounty contract. There is no admin override, no generic withdraw
  function, and the factory itself never holds funds.
- **Reward validation on-chain.** `reward > 0` is enforced in both
  `factory.create_bounty` and `bounty.init`; frontend validation
  (`validateRewardInput`) exists purely for UX and is never trusted for
  correctness.
- **No secrets in the repo.** `.env.local` is gitignored; CI deployment
  uses a GitHub Actions secret; Vercel holds its own copy of the public
  (non-secret) `NEXT_PUBLIC_*` values.
- **Error messages are sanitized.** `frontend/src/lib/errors.ts` maps
  known contract error codes and common wallet failure modes to
  human-readable text and never lets a raw SDK object, `[object Object]`,
  or a `Bad union switch` string reach the UI.

## Screenshots

> Placeholders — replace with real captures after running the app against
> a live testnet deployment. None of the images below exist yet.

| | |
|---|---|
| `docs/screenshots/01-bounty-board.png` | Bounty board / landing page |
| `docs/screenshots/02-create-bounty.png` | Create + fund escrow flow |
| `docs/screenshots/03-bounty-detail.png` | Bounty detail with claim/submit/approve actions |
| `docs/screenshots/04-tx-lifecycle.png` | Transaction status banner mid-confirmation |
| `docs/screenshots/05-creator-dashboard.png` | Creator dashboard |
| `docs/screenshots/06-developer-dashboard.png` | Developer dashboard |
| `docs/screenshots/07-mobile-nav.png` | Mobile responsive nav |
| `docs/screenshots/08-contract-tests-passing.png` | `cargo test` output |
| `docs/screenshots/09-frontend-tests-passing.png` | `npm run test` output |

See `docs/screenshots/README.md` for capture instructions.

## Deployed Contracts

> Not yet deployed. Placeholders only.

| Contract | Network | Contract ID |
|---|---|---|
| Factory | Testnet | `PLACEHOLDER — run scripts/deploy.ps1` |
| Bounty (example instance) | Testnet | `PLACEHOLDER — created via factory.create_bounty()` |

## Sample Transaction

> Not yet available. Placeholder only.

```
Transaction hash: PLACEHOLDER
Explorer link:    https://stellar.expert/explorer/testnet/tx/PLACEHOLDER
```

## Live Demo

> Not yet deployed. Placeholder only: `https://bountyflow-pro.PLACEHOLDER.vercel.app`

## Demo Video

> Not yet recorded. Placeholder only: `docs/demo-video-link.txt`
