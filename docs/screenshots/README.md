# Screenshots

This folder is intentionally empty of actual images in the generated
repository — every screenshot referenced in the root README is a
placeholder until captured against a real, running deployment.

## How to capture the required screenshots

1. Run the deployment pipeline: `./scripts/deploy-all.ps1`.
2. Start the frontend: `cd frontend && npm run dev`.
3. Connect a funded testnet wallet (use https://laboratory.stellar.org/#account-creator?network=test
   or `stellar keys fund` to get testnet XLM).
4. Walk through the full lifecycle (create → fund → claim → submit →
   approve) capturing each named file below at each step:

| Filename | What to capture |
|---|---|
| `01-bounty-board.png` | Home page with at least one open bounty visible |
| `02-create-bounty.png` | The create-bounty form and the funding step |
| `03-bounty-detail.png` | A bounty detail page mid-lifecycle (e.g. Claimed or Submitted) |
| `04-tx-lifecycle.png` | The TxStatusBanner showing "Confirming on-chain..." |
| `05-creator-dashboard.png` | Creator dashboard with 1+ bounties |
| `06-developer-dashboard.png` | Developer dashboard with a claimed bounty |
| `07-mobile-nav.png` | The mobile nav menu open, in a narrow viewport |
| `08-contract-tests-passing.png` | Terminal output of `./scripts/test.ps1` showing all tests passing |
| `09-frontend-tests-passing.png` | Terminal output of `npm run test` showing all tests passing |

5. Save each PNG directly into this folder using the exact filenames
   above so the links in the root README resolve correctly.
