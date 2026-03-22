/# Implementation Plan: Gig Platform (Monad Testnet)

## Overview

Incremental implementation of two Solidity contracts (WorkerRegistry + TaskEscrow) with a Foundry test suite, a Next.js 14 frontend, and IPFS integration via nft.storage. Each task builds on the previous and ends with all code wired together.

## Tasks

- [x] 1. Initialise monorepo and tooling
  - Run `git init`, add remote `https://github.com/DevAnuragT/Gig.git`
  - Scaffold Foundry project under `contracts/` (`forge init --no-git`)
  - Scaffold Next.js 14 App Router project under `frontend/` (`npx create-next-app@latest --app --ts --tailwind --no-src-dir`)
  - Add root `.gitignore` covering `out/`, `cache/`, `.env`, `node_modules/`
  - Create `.env.example` with all variables from the design document
  - Create `contracts/foundry.toml` with `[fuzz] runs = 256` and Monad testnet RPC alias
  - _Requirements: 17.6_

- [ ] 2. WorkerRegistry.sol
  - [x] 2.1 Implement WorkerRegistry.sol and IWorkerRegistry.sol
    - Create `contracts/src/interfaces/IWorkerRegistry.sol` with `isRegistered` view
    - Implement `contracts/src/WorkerRegistry.sol`: `Worker` struct, `workers` mapping, `registerWorker`, `updateSkills`, `isRegistered`, custom errors `AlreadyRegistered` / `NotRegistered`, event `WorkerRegistered`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Write property test: Worker registration round-trip (Property 1)
    - **Property 1: Worker Registration Round-Trip**
    - **Validates: Requirements 1.1, 1.2, 1.6**
    - `testFuzz_workerRegistrationRoundTrip(address addr, bytes32 nameHash, uint64 skillBitmask)` in `WorkerRegistry.t.sol`

  - [x] 2.3 Write property test: Double registration reverts (Property 2)
    - **Property 2: Double Registration Reverts**
    - **Validates: Requirements 1.3**
    - `testFuzz_doubleRegistrationReverts(bytes32 nameHash, uint64 skillBitmask)` in `WorkerRegistry.t.sol`

  - [x] 2.4 Write property test: updateSkills round-trip (Property 3)
    - **Property 3: updateSkills Round-Trip**
    - **Validates: Requirements 1.4**
    - `testFuzz_updateSkillsRoundTrip(uint64 newSkills)` in `WorkerRegistry.t.sol`

  - [x] 2.5 Write property test: updateSkills without registration reverts (Property 4)
    - **Property 4: updateSkills Without Registration Reverts**
    - **Validates: Requirements 1.5**
    - `testFuzz_updateSkillsUnregisteredReverts(address addr, uint64 skills)` in `WorkerRegistry.t.sol`

- [ ] 3. TaskEscrow.sol — core structs, storage, and task creation
  - [x] 3.1 Implement TaskEscrow skeleton and createTask
    - Create `contracts/src/interfaces/ITaskEscrow.sol`
    - Implement `contracts/src/TaskEscrow.sol`: `TaskState` enum, `Task` / `Bid` structs, storage mappings, constants `MAX_TASK_VALUE` and `REVIEW_WINDOW`, constructor accepting `_registry` and `_admin`, `createTask` with all validations and `TaskCreated` event
    - Import OpenZeppelin `ReentrancyGuard`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 13.1, 13.2, 17.1, 17.5_

  - [x] 3.2 Write property test: createTask round-trip (Property 5)
    - **Property 5: createTask Round-Trip**
    - **Validates: Requirements 2.1, 2.5, 2.6**
    - `testFuzz_createTaskRoundTrip(string cid, uint64 deadline, uint256 value)` in `TaskEscrow.t.sol`

  - [x] 3.3 Write property test: task value cap enforced (Property 6)
    - **Property 6: Task Value Cap Enforced**
    - **Validates: Requirements 2.2, 2.3, 13.1, 13.2**
    - `testFuzz_taskValueCapEnforced(uint256 value)` in `TaskEscrow.t.sol`

  - [x] 3.4 Write property test: deadline validation (Property 7)
    - **Property 7: Deadline Validation**
    - **Validates: Requirements 2.4**
    - `testFuzz_deadlineValidation(uint64 deadline)` in `TaskEscrow.t.sol`

- [ ] 4. TaskEscrow.sol — bidding and assignment
  - [x] 4.1 Implement submitBid and assignWorker
    - Add `submitBid(taskId, proposalCid, proposedPrice)`: call `registry.isRegistered`, validate state OPEN, validate price cap, check no duplicate bid, store `Bid` struct, emit `BidSubmitted`
    - Add `assignWorker(taskId, workerAddress)`: validate poster, state OPEN, bid exists, transition to ASSIGNED, emit `WorkerAssigned`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4_

  - [x] 4.2 Write property test: submitBid registration gate (Property 10)
    - **Property 10: submitBid Registration Gate**
    - **Validates: Requirements 4.1**
    - `testFuzz_submitBidRegistrationGate(address unregistered)` in `TaskEscrow.t.sol`

  - [x] 4.3 Write property test: bid round-trip and duplicate revert (Property 11)
    - **Property 11: Bid Round-Trip**
    - **Validates: Requirements 4.4, 4.5**
    - `testFuzz_bidRoundTrip(string cid, uint256 price)` in `TaskEscrow.t.sol`

  - [x] 4.4 Write property test: bid price cap (Property 12)
    - **Property 12: Bid Price Cap**
    - **Validates: Requirements 4.3**
    - `testFuzz_bidPriceCap(uint256 price)` in `TaskEscrow.t.sol`

  - [x] 4.5 Write property test: assignWorker requires existing bid (Property 15)
    - **Property 15: assignWorker Requires Existing Bid**
    - **Validates: Requirements 5.4**
    - `testFuzz_assignWorkerRequiresBid(address worker)` in `TaskEscrow.t.sol`

- [ ] 5. TaskEscrow.sol — deliverable, payment release, and cancellation
  - [x] 5.1 Implement submitDeliverable, approveAndRelease, cancelTask, and withdraw
    - Add `submitDeliverable(taskId, deliverableCid)`: validate assigned worker, state ASSIGNED, set `deliverableCid`, set `reviewDeadline = block.timestamp + REVIEW_WINDOW`, transition to REVIEW, emit `DeliverableSubmitted`
    - Add `approveAndRelease(taskId)`: validate poster, state REVIEW, transition to CLOSED, credit `pendingWithdrawals[worker]`, emit `PaymentReleased`
    - Add `cancelTask(taskId)`: validate poster, state OPEN, transition to CANCELLED, credit `pendingWithdrawals[poster]`, emit `TaskCancelled`
    - Add `withdraw()` with `nonReentrant`: zero balance before transfer (CEI), revert on zero balance, emit nothing (transfer is sufficient)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 12.1, 12.3, 12.4_

  - [ ] 5.2 Write property test: cancelTask refunds poster (Property 16)
    - **Property 16: cancelTask Refunds Poster via Pull-Payment**
    - **Validates: Requirements 6.1, 6.4**
    - `testFuzz_cancelTaskRefundsPoster(uint256 value)` in `TaskEscrow.t.sol`

  - [~] 5.3 Write property test: submitDeliverable sets reviewDeadline (Property 17)
    - **Property 17: submitDeliverable Sets reviewDeadline Correctly**
    - **Validates: Requirements 7.1, 10.5**
    - `testFuzz_submitDeliverableSetsReviewDeadline(string cid)` in `TaskEscrow.t.sol`

  - [~] 5.4 Write property test: approveAndRelease credits worker (Property 18)
    - **Property 18: approveAndRelease Credits Worker**
    - **Validates: Requirements 8.1**
    - `testFuzz_approveAndReleaseCreditsWorker(uint256 value)` in `TaskEscrow.t.sol`

  - [~] 5.5 Write property test: withdraw round-trip with CEI (Property 19)
    - **Property 19: withdraw Round-Trip with Checks-Effects-Interactions**
    - **Validates: Requirements 8.4, 12.4**
    - `testFuzz_withdrawRoundTrip(uint256 value)` in `TaskEscrow.t.sol`

- [ ] 6. TaskEscrow.sol — timeouts and admin
  - [~] 6.1 Implement reclaimAfterTimeout, claimAfterReviewTimeout, and admin functions
    - Add `reclaimAfterTimeout(taskId)` with `nonReentrant`: validate poster, state ASSIGNED, `block.timestamp > deadline`, transition to CANCELLED, credit poster, emit `TaskCancelled`
    - Add `claimAfterReviewTimeout(taskId)` with `nonReentrant`: validate worker, state REVIEW, `block.timestamp > reviewDeadline`, transition to CLOSED, credit worker, emit `PaymentReleased`
    - Add `adminCancel(taskId, reason)`: validate admin, transition to CANCELLED, credit poster, emit `AdminOverride` and `TaskCancelled`
    - Add `proposeAdmin(newAdmin)` and `acceptAdmin()` for two-step transfer; emit `NewAdminProposed`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [~] 6.2 Write property test: reclaimAfterTimeout deadline enforcement (Property 20)
    - **Property 20: reclaimAfterTimeout — Deadline Enforcement**
    - **Validates: Requirements 9.1, 9.2**
    - `testFuzz_reclaimAfterTimeoutDeadlineEnforcement(uint256 warp)` in `TaskEscrowTimeout.t.sol`

  - [~] 6.3 Write property test: claimAfterReviewTimeout enforcement (Property 21)
    - **Property 21: claimAfterReviewTimeout — Review Window Enforcement**
    - **Validates: Requirements 10.1, 10.2**
    - `testFuzz_claimAfterReviewTimeoutEnforcement(uint256 warp)` in `TaskEscrowTimeout.t.sol`

  - [~] 6.4 Write property test: reentrancy blocked on payout functions (Property 22)
    - **Property 22: Reentrancy Blocked on All Payout Functions**
    - **Validates: Requirements 9.4, 10.4, 12.3**
    - `testFuzz_reentrancyBlockedOnPayouts` in `TaskEscrow.t.sol` using a malicious re-entrant contract

  - [~] 6.5 Write property test: balance integrity invariant (Property 23)
    - **Property 23: Balance Integrity Invariant**
    - **Validates: Requirements 12.2**
    - `testFuzz_balanceIntegrityInvariant` in `TaskEscrow.t.sol`

  - [~] 6.6 Write property test: admin two-step transfer (Property 24)
    - **Property 24: Admin Two-Step Transfer Round-Trip**
    - **Validates: Requirements 11.3, 11.4**
    - `testFuzz_adminTwoStepTransfer(address newAdmin)` in `TaskEscrow.t.sol`

  - [~] 6.7 Write property test: adminCancel credits poster (Property 25)
    - **Property 25: adminCancel Credits Poster**
    - **Validates: Requirements 11.1**
    - `testFuzz_adminCancelCreditsPoster` in `TaskEscrow.t.sol`

  - [~] 6.8 Write property test: non-admin adminCancel reverts (Property 26)
    - **Property 26: Non-Admin adminCancel Reverts**
    - **Validates: Requirements 11.2**
    - `testFuzz_nonAdminCancelReverts(address caller)` in `TaskEscrow.t.sol`

- [ ] 7. Cross-cutting contract property tests
  - [~] 7.1 Write property test: state machine invalid transitions (Property 13)
    - **Property 13: State Machine — Invalid Transitions Revert**
    - **Validates: Requirements 4.2, 5.3, 6.3, 7.3, 8.3, 9.3, 10.3**
    - `testFuzz_stateMachineInvalidTransitions` in `TaskEscrow.t.sol`

  - [~] 7.2 Write property test: authorization enforced (Property 14)
    - **Property 14: Authorization — Only Authorized Callers Succeed**
    - **Validates: Requirements 5.2, 6.2, 7.2, 8.2, 9.1, 10.1**
    - `testFuzz_authorizationEnforced(address caller)` in `TaskEscrow.t.sol`

  - [~] 7.3 Write unit tests: full lifecycle flows and constants
    - `test_fullPosterFlow`, `test_fullWorkerFlow`, `test_reviewWindowConstant`, `test_maxTaskValueConstant`, `test_constructorSetsAdminAndRegistry`, `test_adminCancelAssignedTask` in `TaskEscrow.t.sol`
    - _Requirements: 17.3_

- [~] 8. Checkpoint — all contract tests pass
  - Run `forge test -vv` and ensure all tests pass. Ask the user if any questions arise.

- [ ] 9. Deploy script and ABI export
  - [~] 9.1 Implement Deploy.s.sol
    - Create `contracts/script/Deploy.s.sol`: deploy `WorkerRegistry` first, then `TaskEscrow(address(registry), adminAddress)`, log both addresses with `console.log`
    - Read `PRIVATE_KEY`, `ADMIN_ADDRESS` from environment; broadcast with `vm.startBroadcast`
    - _Requirements: 17.1, 17.2, 17.4_

  - [~] 9.2 Add ABI export step
    - Add shell commands to `contracts/Makefile` (or document in README): `forge inspect TaskEscrow abi > ../frontend/src/abi/TaskEscrow.json` and `forge inspect WorkerRegistry abi > ../frontend/src/abi/WorkerRegistry.json`
    - Create `frontend/src/abi/` directory with placeholder `.gitkeep`
    - _Requirements: 17.4_

- [ ] 10. Frontend: wagmi/viem setup and chain config
  - [~] 10.1 Install dependencies and configure wagmi v2
    - Install `wagmi`, `viem`, `@tanstack/react-query`, `@rainbow-me/rainbowkit` (or `wagmi` connectors for MetaMask + WalletConnect v2)
    - Create `frontend/src/lib/wagmi.ts`: define `monadTestnet` chain object (id 143, MON, RPC from env, block explorers), create wagmi config with `http()` transport and wallet connectors
    - Create `frontend/src/lib/contracts.ts`: export `TASK_ESCROW` and `WORKER_REGISTRY` config objects with address + ABI
    - Wrap `frontend/src/app/layout.tsx` with `WagmiProvider` and `QueryClientProvider`
    - _Requirements: 15.1, 15.2, 15.3, 17.5_

  - [~] 10.2 Write unit test: Monad testnet chain config (Property 9 frontend)
    - Verify `monadTestnet.id === 143`, `nativeCurrency.symbol === 'MON'`, and block explorer URL in `frontend/src/__tests__/lib/wagmi.test.ts`
    - _Requirements: 15.1_

- [ ] 11. Frontend: IPFS utilities
  - [~] 11.1 Implement pinToIPFS and fetchFromIPFS in lib/ipfs.ts
    - `pinToIPFS(metadata: object): Promise<string>` — POST to `https://api.nft.storage/upload` with `Authorization: Bearer ${NFT_STORAGE_API_KEY}`, return CID
    - `fetchFromIPFS<T>(cid: string): Promise<T>` — GET from `https://cloudflare-ipfs.com/ipfs/{cid}`, return parsed JSON
    - Handle fetch errors; throw descriptive errors for retry UI
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 12. Frontend: shared components and layout
  - [~] 12.1 Implement ConnectButton, NavBar, and TaskCard components
    - `ConnectButton`: wraps wagmi `useConnect` / `useDisconnect`, shows address when connected, triggers `wallet_addEthereumChain` for chainId 143 if wrong network
    - `NavBar`: links to `/`, `/tasks/create`, `/dashboard`; shows `ConnectButton`
    - `TaskCard`: renders budget (formatted in MON), deadline (human-readable), truncated poster address (first 6 chars); lazy-fetches IPFS title on expand
    - _Requirements: 3.2, 15.2, 16.6_

- [ ] 13. Frontend: task feed page (/)
  - [~] 13.1 Implement `/` page with event-driven task index
    - Use `useWatchContractEvent` on `TaskCreated` to build in-memory task array in a React context or Zustand store
    - Render `TaskCard` list; add client-side filter controls for skill bitmask, minimum budget, and deadline range
    - Show loading skeleton while initial events are fetched
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 16.1_

  - [~] 13.2 Write property test: task feed filter correctness (Property 8)
    - **Property 8: Task Feed Filter Correctness**
    - **Validates: Requirements 3.3**
    - Use `fast-check` in `frontend/src/__tests__/lib/filterTasks.test.ts`; generate arbitrary task arrays and filter params, assert filtered result contains only matching tasks

  - [~] 13.3 Write property test: task card renders required fields (Property 9)
    - **Property 9: Task Card Rendering Contains Required Fields**
    - **Validates: Requirements 3.2**
    - Use `fast-check` + React Testing Library in `frontend/src/__tests__/components/TaskCard.test.tsx`; generate arbitrary task objects, assert budget, deadline, and truncated address appear in rendered output

- [ ] 14. Frontend: task detail page (/tasks/[id])
  - [~] 14.1 Implement `/tasks/[id]` page
    - Use `useReadContract` to read `tasks[id]` from TaskEscrow
    - Use `useWatchContractEvent` on `BidSubmitted` filtered by taskId to list bids
    - Fetch task metadata JSON from Cloudflare IPFS gateway using stored CID; show "metadata unavailable" on failure
    - If task state is REVIEW, display deliverable CID with link
    - If connected wallet is poster and state is REVIEW, show "Approve & Release" button calling `approveAndRelease`
    - If connected wallet is poster and state is OPEN, show "Assign Worker" UI per bid row
    - _Requirements: 16.2, 3.4, 8.1, 5.1_

- [ ] 15. Frontend: create task page (/tasks/create)
  - [~] 15.1 Implement `/tasks/create` page
    - Redirect unauthenticated users to connect prompt
    - Form fields: title, description (markdown), skills (bitmask checkboxes), budget (MON), deadline (date picker)
    - On submit: upload metadata JSON to nft.storage via `pinToIPFS`, then call `createTask(cid, deadline)` with `msg.value = budget`
    - Show spinner with tx hash link to MonadVision while pending; show success/error state
    - _Requirements: 14.1, 16.3, 15.4_

- [ ] 16. Frontend: worker profile page (/profile/[address])
  - [~] 16.1 Implement `/profile/[address]` page
    - Use `useReadContract` to read `workers[address]` from WorkerRegistry
    - Display registration status, skill bitmask as human-readable tags, and nameHash
    - If connected wallet matches address and is not registered: show "Register" form (display name, bio, skills); on submit: upload profile JSON via `pinToIPFS`, derive `nameHash = keccak256(displayName)`, call `registerWorker(nameHash, skillBitmask)`
    - If registered and wallet matches: show "Update Skills" form calling `updateSkills`
    - _Requirements: 14.4, 16.4, 1.1, 1.2, 1.4_

- [ ] 17. Frontend: dashboard page (/dashboard)
  - [~] 17.1 Implement `/dashboard` page
    - Redirect unauthenticated users to connect prompt
    - "My Tasks (Poster)" tab: filter in-memory task index by `poster == connectedAddress`; show state badge and action buttons (Cancel, Assign, Approve)
    - "My Bids (Worker)" tab: watch `BidSubmitted` events filtered by `worker == connectedAddress`; show task title and bid status
    - Show pending withdrawal balance from `pendingWithdrawals[address]` with "Withdraw" button calling `withdraw()`
    - _Requirements: 16.5, 8.4_

- [ ] 18. Frontend: bid submission and deliverable submission flows
  - [~] 18.1 Implement bid submission on task detail page
    - If connected wallet is a registered worker and task state is OPEN: show "Submit Bid" form (proposal text, price)
    - On submit: upload proposal JSON via `pinToIPFS`, call `submitBid(taskId, proposalCid, proposedPrice)`
    - _Requirements: 14.2, 4.1, 4.4_

  - [~] 18.2 Implement deliverable submission on task detail page
    - If connected wallet is assigned worker and task state is ASSIGNED: show "Submit Deliverable" form (summary, notes, file CIDs)
    - On submit: upload deliverable JSON via `pinToIPFS`, call `submitDeliverable(taskId, deliverableCid)`
    - _Requirements: 14.3, 7.1_

- [~] 19. Checkpoint — frontend smoke tests pass
  - Run `cd frontend && npx jest --testPathPattern="__tests__" --passWithNoTests` and ensure all tests pass. Ask the user if any questions arise.

- [ ] 20. README and deployment documentation
  - [~] 20.1 Write root README.md
    - Monorepo structure overview, prerequisites (Foundry, Node 18+, MetaMask)
    - Contract deployment steps: `cp .env.example .env`, fill vars, `forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast`, ABI export commands
    - Frontend setup: `cd frontend && npm install && npm run dev`, required env vars
    - Monad testnet details: chainId 143, RPC, block explorers
    - _Requirements: 17.4, 17.6_

- [~] 21. Final checkpoint — all tests pass
  - Run `forge test -vv` (contracts) and `cd frontend && npx jest --passWithNoTests` (frontend). Ensure all tests pass. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use Foundry fuzzing (256 runs) for contracts and `fast-check` for frontend
- All ETH payouts use pull-payment pattern; no direct `.call{value}()` outside `withdraw()`
- ABI files in `frontend/src/abi/` are generated by the deploy step, not committed manually
