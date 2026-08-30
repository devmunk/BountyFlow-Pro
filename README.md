# BountyFlow Pro

A decentralized bounty marketplace built on **Stellar Soroban**, where bounty rewards are held in real on-chain escrow and released by the smart contract when the creator approves completed work.

BountyFlow Pro is the **Level 3 evolution of BountyFlow**. It uses Soroban contracts and the Stellar Asset Contract (SAC) for real XLM movement on Stellar Testnet.

---

## Contents

- [What BountyFlow Pro Does](#what-bountyflow-pro-does)
- [Screenshots and Demo](#screenshots-and-demo)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Escrow and Payment Flow](#escrow-and-payment-flow)
- [Events and Live Activity](#events-and-live-activity)
- [Wallet and Transaction Architecture](#wallet-and-transaction-architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Setup and Deployment](#setup-and-deployment)
- [Testing and CI/CD](#testing-and-cicd)
- [Security](#security)
- [Level 3 Scope](#level-3-scope)

---

## What BountyFlow Pro Does

BountyFlow Pro connects two roles.

### Creator

A creator can:

1. Connect a supported Stellar wallet.
2. Create a bounty with a title, description, XLM reward, and claim timeout.
3. Deploy a dedicated bounty contract through the factory.
4. Fund the bounty's escrow with real XLM.
5. Review submitted work.
6. Approve completed work.
7. Release the escrowed reward to the developer.
8. Cancel/refund a bounty when the contract rules permit it.

### Developer

A developer can:

1. Connect a supported Stellar wallet.
2. Browse open bounties.
3. Claim an open bounty.
4. Submit completed work with a description and optional link.
5. Track the bounty's on-chain state.
6. Receive the escrowed reward after creator approval.

There is **no custodial backend holding rewards**. Each bounty contract owns its escrowed XLM.

---

### Screenshots

#### Bounty Board

![Bounty Board](docs/screenshots/bounty-board.png)

#### Create Bounty

![Create Bounty](docs/screenshots/create-bounty.png)

#### Bounty Detail

![Bounty Detail](docs/screenshots/bounty-detail.png)

#### Creator Dashboard

![Creator Dashboard](docs/screenshots/creator-dashboard.png)

#### Developer Dashboard

![Developer Dashboard](docs/screenshots/developer-dashboard.png)

#### Live Activity

![Live Activity](docs/screenshots/live-activity.png)

#### Mobile Responsive UI

![Mobile Responsive UI](docs/screenshots/mobile-responsive.png)

#### Transaction Lifecycle

![Transaction Lifecycle](docs/screenshots/transaction-lifecycle.png)

#### CI/CD Pipeline

![CI/CD Pipeline](docs/screenshots/ci-pipeline.png)

#### Test Output

![Test Output](docs/screenshots/test-output.png)

---

### Deployed Contracts

Replace these placeholders with the actual Testnet addresses:

```text
Factory:         CCPJGZQIR2WFJRBU5MCWLM4QIGGXWL7D3UMMWYIQ4FL7QDLKRJOXCDMB
Bounty:          CC7MOHS5SFN3SM3F6YP5QOGBDNFGNPSX33ZIHMSPLIML3MGRSTQFUZ2B
Native XLM SAC:  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### Sample Transaction

Use a real successful contract interaction:

```text
Transaction hash: 17de72a756e66a0354402320b0936bafec0c957fdc9c040fbe7facda6ccf42ea
Explorer:         https://stellar.expert/explorer/testnet/tx/17de72a756e66a0354402320b0936bafec0c957fdc9c040fbe7facda6ccf42ea
```

### Live Demo

```text

```

### Demo Video

1–2 minute demonstration:

```text
https://youtu.be/l8Ww8Yey8JE?si=3icb8RNDa9lZFAW-
```

Recommended flow:

```text
Connect
  → Create bounty
  → Fund
  → Claim
  → Submit work
  → Approve
  → Release reward
  → Live Activity
```

---

## Features

### Marketplace

- Open bounty board
- Individual bounty detail pages
- Creator dashboard
- Developer dashboard
- Responsive dark interface
- Loading, empty, error, and transaction states

### Creator workflow

- Wallet connection
- Bounty creation
- On-chain bounty deployment
- XLM escrow funding
- Submission review
- Approval and automatic reward release
- Refund/cancellation when allowed

### Developer workflow

- Browse open bounties
- Claim
- Submit work
- View current bounty status
- Receive payment after approval

### Wallets

The frontend uses **Stellar Wallets Kit** with:

- Freighter
- xBull
- Albedo

Wallet state is shared through `WalletProvider` and `useWallet`. The selected wallet ID is remembered locally so the application can attempt a reconnect when appropriate.

Wallet and transaction cancellation errors are normalized into user-facing messages.

### Live Activity

The Live Activity feed is backed directly by Soroban RPC events.

It supports:

- Bounty creation
- Funding
- Claim
- Work submission
- Approval
- Reward release
- Refund
- Automatic polling
- Event de-duplication
- Manual refresh
- Re-fetching affected bounty data

Events are used as change signals; contract reads remain authoritative for current bounty state.

---

## Architecture

BountyFlow Pro intentionally has no application backend or database.

```text
                    ┌─────────────────────────────┐
                    │      Next.js Frontend       │
                    │                             │
                    │ Pages / Components          │
                    │ WalletProvider / useWallet  │
                    │ useBounties                 │
                    │ useBountyEvents             │
                    │ useTransaction              │
                    └──────────────┬──────────────┘
                                   │
                         Wallet signing / RPC
                                   │
                    ┌──────────────▼──────────────┐
                    │     Stellar Soroban RPC     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       Factory Contract      │
                    │                             │
                    │ bounty ID → contract        │
                    │ creator → bounty IDs        │
                    │ stored bounty WASM hash     │
                    └──────────────┬──────────────┘
                                   │
                              deploy + init
                                   │
                    ┌──────────────▼──────────────┐
                    │      Bounty Contract #N     │
                    │                             │
                    │ creator / claimant / reward │
                    │ state / submission / token │
                    │ timeout                     │
                    │                             │
                    │ owns escrowed XLM           │
                    └──────────────┬──────────────┘
                                   │
                              token.transfer
                                   │
                    ┌──────────────▼──────────────┐
                    │    Stellar Asset Contract  │
                    │          Native XLM         │
                    └─────────────────────────────┘
```

The blockchain is the source of truth:

- The factory stores bounty registration data.
- Each bounty contract stores its own state.
- Each bounty contract holds its own escrow.
- Soroban RPC provides contract reads, transaction submission/confirmation, and event access.

---

## Smart Contracts

### Factory contract

`contracts/factory/`

- Stores the bounty WASM hash and native XLM SAC address.
- Deploys and initializes a new bounty contract for every bounty.
- Maintains bounty ID → contract address.
- Maintains creator → bounty IDs.
- Can update the WASM hash used for **future** bounties.

### Bounty contract

`contracts/bounty/`

- One independent contract instance per bounty.
- Stores creator, claimant, reward, metadata, submission, timeout, state, and token.
- Its own contract address holds the escrowed XLM.
- Enforces authorization and valid state transitions on-chain.

This isolates escrow between bounties and demonstrates Soroban inter-contract communication.

---

## Escrow and Payment Flow

### Creation and funding

```text
Creator
   │
   │ create_bounty()
   ▼
Factory
   │
   ├── deploy bounty contract
   └── initialize bounty
           │
           ▼
        Created
           │
           │ fund()
           ▼
    Native XLM SAC
           │
           │ transfer
           ▼
    Bounty Contract
           │
           ▼
          Open
```

### Claim and submission

```text
Developer
   │
   │ claim()
   ▼
 Claimed
   │
   │ submit(description, link)
   ▼
 Submitted
```

### Approval and payout

```text
Creator
   │
   │ approve()
   ▼
Bounty Contract
   │
   ├── state → Released
   └── token.transfer(contract → claimant)
                         │
                         ▼
                  Developer receives XLM
```

### Refund

```text
Creator
   │
   │ cancel()
   ▼
Bounty Contract
   │
   ├── state → Refunded
   └── token.transfer(contract → creator)
```

The escrow is therefore a verifiable on-chain balance at the bounty contract address, not a number maintained only by the frontend.

---

## Events and Live Activity

Contracts emit typed events for state-changing actions:

```text
BountyCreated
BountyFunded
BountyClaimed
WorkSubmitted
BountyApproved
RewardReleased
BountyRefunded
```

Frontend implementation:

```text
frontend/src/lib/events.ts
frontend/src/hooks/useBountyEvents.ts
frontend/src/components/ActivityFeed.tsx
```

The event subscription:

- Watches the factory contract.
- Watches relevant bounty contract addresses.
- Polls Soroban RPC approximately every 6 seconds.
- Starts with a 1000-ledger lookback.
- Chunks watched contract IDs into groups of at most 5.
- Requests up to 100 events per poll.
- Keeps a bounded in-memory feed.
- De-duplicates events using `ledger:eventId`.
- Cleans up its timer when the React effect is removed.

Manual Refresh asks the existing subscription to poll immediately.

A newly created bounty can briefly appear as **Unknown bounty** because the event may arrive before the bounty metadata has entered the current page state. Refreshing the activity stream resolves that synchronization gap.

---

## Wallet and Transaction Architecture

### Wallet

Wallet integration is split between:

```text
frontend/src/lib/wallet.ts
frontend/src/components/WalletProvider.tsx
frontend/src/hooks/useWallet.ts
```

The application uses:

- Freighter
- xBull
- Albedo

`WalletProvider` shares the current wallet address, wallet name, connection state, errors, and connect/disconnect actions across the application.

### Transactions

Transactions use:

```text
frontend/src/lib/soroban.ts
frontend/src/hooks/useTransaction.ts
```

Lifecycle:

```text
preparing
   ↓
simulating
   ↓
awaiting-wallet
   ↓
submitted
   ↓
confirming
   ↓
success
```

Any failure enters:

```text
error
```

A submitted hash is not treated as success. The UI waits for confirmed Soroban success.

`useTransaction` also prevents duplicate submissions and keeps wallet-dependent actions using the current connected wallet state.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Smart contracts | Rust + `soroban-sdk` |
| Blockchain | Stellar Soroban Testnet |
| Reward asset | Native XLM through Stellar Asset Contract |
| Frontend | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Wallet integration | `@creit.tech/stellar-wallets-kit` |
| Stellar client | `@stellar/stellar-sdk` |
| Frontend tests | Vitest + Testing Library |
| Contract tests | Rust / Cargo tests |
| CI/CD | GitHub Actions |
| Deployment scripting | PowerShell |
| Backend/database | None |

---

## Repository Structure

```text
BountyFlow-Pro/
│
├── contracts/
│   ├── factory/
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   └── bounty/
│       └── src/
│           ├── lib.rs
│           └── test.rs
│
├── scripts/
│   ├── build.ps1
│   ├── test.ps1
│   ├── deploy.ps1
│   ├── configure-frontend.ps1
│   └── deploy-all.ps1
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── tests/
│   └── package.json
│
├── deployments/
├── docs/
│   └── screenshots/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-contracts.yml
├── .env.example
└── README.md
```

---

## Setup and Deployment

### Prerequisites

- Node.js 20+
- Rust
- `wasm32v1-none`
- Stellar CLI
- A supported Stellar wallet

The project uses PowerShell commands and is Windows-first.

Install the required Rust WASM target:

```powershell
rustup target add wasm32v1-none
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Validation:

```powershell
npm run typecheck
npm run build
```

### Environment

The frontend uses:

```text
NEXT_PUBLIC_STELLAR_NETWORK
NEXT_PUBLIC_SOROBAN_RPC_URL
NEXT_PUBLIC_NETWORK_PASSPHRASE
NEXT_PUBLIC_FACTORY_CONTRACT_ID
NEXT_PUBLIC_TOKEN_CONTRACT_ID
NEXT_PUBLIC_DEFAULT_CLAIM_TIMEOUT_SECS
```

`DEPLOYER_SECRET_KEY` is deployment-only and must never be a `NEXT_PUBLIC_*` variable.

### Contract deployment

```powershell
./scripts/deploy-all.ps1 -IdentityName bountyflow-deployer -Network testnet
```

Or:

```powershell
./scripts/build.ps1
./scripts/test.ps1
./scripts/deploy.ps1 -IdentityName bountyflow-deployer -Network testnet
./scripts/configure-frontend.ps1 -Network testnet
```

Deployment writes contract information to `deployments/latest.json`.

When bounty WASM is upgraded, existing bounty instances keep their current implementation; the factory's new WASM hash applies to future bounties.

### Frontend deployment

Deploy `frontend/` using the standard Next.js/Vercel configuration and provide the required public environment variables.

---

## Testing and CI/CD

### Contracts

```powershell
./scripts/test.ps1
```

Contract tests cover deployment, authorization, claiming, submission, approval/release, refunds, timeout handling, invalid transitions, duplicate payout protection, and reward validation.

### Frontend

```powershell
cd frontend
npm run test
npm run typecheck
npm run build
```

Frontend tests cover validation, error handling, UI rendering, transaction lifecycle, and duplicate submission protection.

### CI/CD

GitHub Actions runs the contract and frontend validation pipeline, including build/test/typecheck/lint checks. Contract deployment is available through the deployment workflow.

For submission evidence, add a screenshot of a **successful CI pipeline** to:

```text
docs/screenshots/ci-pipeline.png
```

Add test output showing **3+ passing tests** to:

```text
docs/screenshots/test-output.png
```

---

## Security

- **Authorization is enforced on-chain.** Frontend role checks are UX only.
- **Escrow is isolated.** Each bounty owns its own XLM balance.
- **No generic withdrawal** is provided.
- **State changes occur before transfers** on payout/refund paths.
- **Rewards are validated on-chain** to be positive.
- **Secrets are not committed** or exposed through public environment variables.
- **Wallet and contract errors are sanitized** before reaching the UI.

---

## Level 3 Scope

BountyFlow Pro demonstrates:

- Advanced Soroban smart contracts
- Inter-contract communication
- Real XLM escrow
- On-chain state machines
- Typed blockchain events
- Event polling and live activity updates
- Shared wallet state
- Transaction lifecycle handling
- Error and loading states
- Contract and frontend tests
- CI/CD
- Scripted smart-contract deployment
- Responsive Next.js frontend
- Production-oriented project structure

---

## License

Add the project's chosen license here before public distribution.
