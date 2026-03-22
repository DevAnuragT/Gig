# Requirements Document — Gig Platform (Monad Testnet)

## Introduction

Gig is a decentralized gig marketplace deployed on Monad testnet. A poster locks funds in escrow, a worker completes the task, and payment is released trustlessly via smart contract. The MVP covers the full poster-worker lifecycle: task creation, bidding, assignment, deliverable submission, payment release, and timeout protection. No reputation scoring, no arbitration pool, no token.

---

## Glossary

- **TaskEscrow**: The primary smart contract that manages task lifecycle, escrow funds, bids, and payment release.
- **WorkerRegistry**: A separate smart contract that stores worker registrations and exposes `isRegistered()`.
- **Poster**: An Ethereum account that creates a task and locks funds in escrow.
- **Worker**: An Ethereum account registered in WorkerRegistry that submits bids and delivers work.
- **Admin**: The deployer-controlled EOA or multisig address set at contract construction time; changeable only via two-step `transferAdmin`.
- **Task**: An on-chain record in TaskEscrow representing a unit of work with escrowed funds.
- **Bid**: An on-chain struct `{ proposalCid, proposedPrice, exists }` stored per task per worker address.
- **CID**: A content identifier returned by nft.storage after pinning a JSON blob to IPFS.
- **Pull-payment ledger**: A `mapping(address => uint256) pendingWithdrawals` used for all ETH payouts; no direct `.call{value}()` to arbitrary addresses.
- **REVIEW_WINDOW**: A 7-day constant after which a worker may auto-claim payment if the poster has not approved.
- **MAX_TASK_VALUE**: A 1 ether cap enforced at task creation.
- **Monad testnet**: EVM-compatible chain with chainId 143 (0x8f), currency MON, block gas limit 200 000 000.

---

## Requirements

### Requirement 1: Worker Registration

**User Story:** As a worker, I want to register my wallet with a name and skill set, so that I can be eligible to bid on tasks.

#### Acceptance Criteria

1. THE WorkerRegistry SHALL store a `Worker` struct containing `nameHash` (bytes32), `skillBitmask` (uint64), and `registered` (bool) for each registered address.
2. WHEN a wallet calls `registerWorker(nameHash, skillBitmask)`, THE WorkerRegistry SHALL set `workers[msg.sender].registered = true` and emit `WorkerRegistered(msg.sender, nameHash, skillBitmask)`.
3. IF a wallet calls `registerWorker` a second time, THEN THE WorkerRegistry SHALL revert with a descriptive error.
4. WHEN a wallet calls `updateSkills(skillBitmask)`, THE WorkerRegistry SHALL update `workers[msg.sender].skillBitmask` to the new value.
5. IF a wallet calls `updateSkills` without being registered, THEN THE WorkerRegistry SHALL revert with a descriptive error.
6. THE WorkerRegistry SHALL expose `isRegistered(address worker) external view returns (bool)` for use by TaskEscrow.
7. THE WorkerRegistry SHALL define skill categories as a bitmask where bit 0 = smart contract development, bit 1 = frontend development, bit 2 = backend development, bit 3 = UI/UX design, bit 4 = security audit, bit 5 = technical writing, bit 6 = data labeling, bit 7 = QA/testing, and bits 8–63 are reserved.

---

### Requirement 2: Task Creation

**User Story:** As a poster, I want to create a task with escrowed funds, so that workers can trust payment will be released on completion.

#### Acceptance Criteria

1. WHEN a poster calls `createTask(metadataCid, deadline)` with `msg.value > 0`, THE TaskEscrow SHALL create a `Task` struct, lock `msg.value` as escrow, assign a monotonically incrementing `taskId`, and emit `TaskCreated(taskId, poster, metadataCid, budget, deadline)`.
2. IF `msg.value` exceeds `MAX_TASK_VALUE` (1 ether), THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF `msg.value` equals zero, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. IF `deadline` is not strictly greater than `block.timestamp`, THEN THE TaskEscrow SHALL revert with a descriptive error.
5. THE TaskEscrow SHALL initialise the new task with state `OPEN`.
6. THE TaskEscrow SHALL store `metadataCid` as the IPFS CID of the task metadata JSON uploaded via nft.storage.

---

### Requirement 3: Task Discovery

**User Story:** As an unauthenticated user, I want to browse open tasks on a public feed, so that I can find work without connecting a wallet.

#### Acceptance Criteria

1. THE Frontend SHALL read all `TaskCreated` events from TaskEscrow using `useWatchContractEvent` (wagmi v2) and maintain an in-memory task index without a backend database.
2. THE Frontend SHALL display each task card with: title (fetched lazily from IPFS on expand), budget, deadline, and truncated poster address.
3. THE Frontend SHALL support filtering the task list by skill bitmask, minimum budget, and deadline range using client-side logic.
4. THE Frontend SHALL fetch task metadata JSON from the Cloudflare IPFS gateway using the CID stored on-chain.
5. THE Frontend SHALL load the task feed in under 2 seconds on Monad testnet (chainId 143).

---

### Requirement 4: Bid Submission

**User Story:** As a worker, I want to submit a bid on an open task, so that the poster can evaluate my proposal and price.

#### Acceptance Criteria

1. WHEN a registered worker calls `submitBid(taskId, proposalCid, proposedPrice)`, THE TaskEscrow SHALL call `IWorkerRegistry(registry).isRegistered(msg.sender)` at the top of the function and revert if the caller is not registered.
2. IF the task state is not `OPEN`, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF `proposedPrice` exceeds the task's `budget`, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. THE TaskEscrow SHALL store the bid in `mapping(uint256 => mapping(address => Bid)) bids` where `Bid` is a struct containing `proposalCid` (string), `proposedPrice` (uint256), and `exists` (bool).
5. IF a worker calls `submitBid` on a task where `bids[taskId][msg.sender].exists` is already true, THEN THE TaskEscrow SHALL revert with a descriptive error.
6. WHEN a bid is stored, THE TaskEscrow SHALL emit `BidSubmitted(taskId, worker, proposalCid, proposedPrice)`.

---

### Requirement 5: Worker Assignment

**User Story:** As a poster, I want to assign a specific worker from the submitted bids, so that the task moves forward with a chosen worker.

#### Acceptance Criteria

1. WHEN the poster calls `assignWorker(taskId, workerAddress)`, THE TaskEscrow SHALL verify `msg.sender == task.poster`, verify the task state is `OPEN`, verify `bids[taskId][workerAddress].exists` is true, transition the task state to `ASSIGNED`, set `task.worker = workerAddress`, and emit `WorkerAssigned(taskId, workerAddress)`.
2. IF `msg.sender` is not the task poster, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF the task state is not `OPEN`, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. IF `bids[taskId][workerAddress].exists` is false, THEN THE TaskEscrow SHALL revert with a descriptive error.

---

### Requirement 6: Task Cancellation by Poster

**User Story:** As a poster, I want to cancel an open task before any worker is assigned, so that I can recover my escrowed funds if plans change.

#### Acceptance Criteria

1. WHEN the poster calls `cancelTask(taskId)`, THE TaskEscrow SHALL verify `msg.sender == task.poster`, verify the task state is `OPEN`, transition the task state to `CANCELLED`, credit `task.budget` to `pendingWithdrawals[task.poster]`, and emit `TaskCancelled(taskId, task.poster)`.
2. IF `msg.sender` is not the task poster, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF the task state is not `OPEN`, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. THE TaskEscrow SHALL credit the refund to the pull-payment ledger; the poster SHALL call `withdraw()` to receive the funds.

---

### Requirement 7: Deliverable Submission

**User Story:** As an assigned worker, I want to submit my deliverable on-chain, so that the poster can review and release payment.

#### Acceptance Criteria

1. WHEN the assigned worker calls `submitDeliverable(taskId, deliverableCid)`, THE TaskEscrow SHALL verify `msg.sender == task.worker`, verify the task state is `ASSIGNED`, transition the task state to `REVIEW`, set `task.deliverableCid = deliverableCid`, set `task.reviewDeadline = block.timestamp + REVIEW_WINDOW`, and emit `DeliverableSubmitted(taskId, deliverableCid)`.
2. IF `msg.sender` is not the assigned worker, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF the task state is not `ASSIGNED`, THEN THE TaskEscrow SHALL revert with a descriptive error.

---

### Requirement 8: Payment Release

**User Story:** As a poster, I want to approve a deliverable and release payment, so that the worker is compensated for completed work.

#### Acceptance Criteria

1. WHEN the poster calls `approveAndRelease(taskId)`, THE TaskEscrow SHALL verify `msg.sender == task.poster`, verify the task state is `REVIEW`, transition the task state to `CLOSED`, credit `task.budget` to `pendingWithdrawals[task.worker]`, and emit `PaymentReleased(taskId, task.worker, task.budget)`.
2. IF `msg.sender` is not the task poster, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF the task state is not `REVIEW`, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. WHEN a worker calls `withdraw()`, THE TaskEscrow SHALL transfer `pendingWithdrawals[msg.sender]` to `msg.sender`, set the balance to zero before the transfer (checks-effects-interactions), and apply `nonReentrant` guard.
5. IF `pendingWithdrawals[msg.sender]` is zero, THEN THE TaskEscrow SHALL revert with a descriptive error.

---

### Requirement 9: Timeout — Worker No-Show

**User Story:** As a poster, I want to reclaim escrowed funds if the assigned worker misses the deadline, so that my funds are not locked indefinitely.

#### Acceptance Criteria

1. WHEN the poster calls `reclaimAfterTimeout(taskId)`, THE TaskEscrow SHALL verify `msg.sender == task.poster`, verify the task state is `ASSIGNED`, verify `block.timestamp > task.deadline`, transition the task state to `CANCELLED`, credit `task.budget` to `pendingWithdrawals[task.poster]`, and emit `TaskCancelled(taskId, task.poster)`.
2. IF `block.timestamp` is not greater than `task.deadline`, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF the task state is not `ASSIGNED`, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. THE TaskEscrow SHALL apply `nonReentrant` guard to `reclaimAfterTimeout`.

---

### Requirement 10: Timeout — Poster No-Review

**User Story:** As a worker, I want to auto-claim payment if the poster ignores my deliverable for 7 days, so that I am protected from silent posters.

#### Acceptance Criteria

1. WHEN the worker calls `claimAfterReviewTimeout(taskId)`, THE TaskEscrow SHALL verify `msg.sender == task.worker`, verify the task state is `REVIEW`, verify `block.timestamp > task.reviewDeadline`, transition the task state to `CLOSED`, credit `task.budget` to `pendingWithdrawals[task.worker]`, and emit `PaymentReleased(taskId, task.worker, task.budget)`.
2. IF `block.timestamp` is not greater than `task.reviewDeadline`, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. IF the task state is not `REVIEW`, THEN THE TaskEscrow SHALL revert with a descriptive error.
4. THE TaskEscrow SHALL apply `nonReentrant` guard to `claimAfterReviewTimeout`.
5. THE TaskEscrow SHALL define `REVIEW_WINDOW` as a constant equal to 7 days (604 800 seconds).

---

### Requirement 11: Emergency Admin Override

**User Story:** As the platform admin, I want to cancel any task in cases of clear abuse, so that users are protected while the contracts are unaudited.

#### Acceptance Criteria

1. WHEN the Admin calls `adminCancel(taskId, reason)`, THE TaskEscrow SHALL verify `msg.sender == admin`, transition the task state to `CANCELLED`, credit `task.budget` to `pendingWithdrawals[task.poster]`, and emit `AdminOverride(taskId, reason)` and `TaskCancelled(taskId, task.poster)`.
2. IF `msg.sender` is not the Admin, THEN THE TaskEscrow SHALL revert with a descriptive error.
3. THE TaskEscrow SHALL support two-step admin transfer: the current Admin calls `proposeAdmin(newAdmin)` which emits `NewAdminProposed(newAdmin)`, and then `newAdmin` calls `acceptAdmin()` to complete the transfer.
4. IF `acceptAdmin()` is called by any address other than the pending proposed admin, THEN THE TaskEscrow SHALL revert with a descriptive error.
5. THE TaskEscrow SHALL set the Admin address at construction time via the constructor argument.

---

### Requirement 12: Pull-Payment Integrity

**User Story:** As any platform participant, I want all ETH payouts to use a pull-payment pattern, so that reentrancy attacks and failed transfers cannot block the contract.

#### Acceptance Criteria

1. THE TaskEscrow SHALL never transfer ETH directly to any address via `.call{value}()` outside of `withdraw()`.
2. THE TaskEscrow SHALL maintain `pendingWithdrawals[address]` such that the sum of all pending balances plus the contract's ETH balance equals the total escrowed funds at all times (balance integrity invariant).
3. THE TaskEscrow SHALL apply `nonReentrant` to `withdraw()`.
4. WHEN `withdraw()` is called, THE TaskEscrow SHALL zero the caller's balance before executing the ETH transfer (checks-effects-interactions pattern).

---

### Requirement 13: Task Value Cap

**User Story:** As a platform user, I want a maximum task value enforced on-chain, so that the blast radius of any exploit is bounded during the unaudited MVP phase.

#### Acceptance Criteria

1. THE TaskEscrow SHALL define `MAX_TASK_VALUE` as a public constant equal to 1 ether.
2. IF `msg.value` exceeds `MAX_TASK_VALUE` at `createTask`, THEN THE TaskEscrow SHALL revert with a descriptive error.

---

### Requirement 14: IPFS Metadata Pinning via nft.storage

**User Story:** As a poster or worker, I want task metadata, bid proposals, deliverables, and worker profiles pinned to IPFS, so that content is permanently accessible without a centralised server.

#### Acceptance Criteria

1. THE Frontend SHALL upload task metadata JSON to nft.storage using the nft.storage HTTP API and receive a CID before calling `createTask`.
2. THE Frontend SHALL upload bid proposal JSON to nft.storage and receive a CID before calling `submitBid`.
3. THE Frontend SHALL upload deliverable JSON to nft.storage and receive a CID before calling `submitDeliverable`.
4. THE Frontend SHALL upload worker profile JSON to nft.storage and receive a CID before calling `registerWorker`.
5. THE Frontend SHALL fetch all IPFS content for display using the Cloudflare IPFS gateway (`https://cloudflare-ipfs.com/ipfs/{cid}`).
6. THE nft.storage HTTP API SHALL be called client-side using the `NFT_STORAGE_API_KEY` environment variable; no server-side proxy is required.

---

### Requirement 15: Wallet and Chain Configuration

**User Story:** As a user, I want the frontend to automatically configure the Monad testnet in my wallet, so that I do not need to add the network manually.

#### Acceptance Criteria

1. THE Frontend SHALL configure wagmi v2 with Monad testnet: chainId 143 (0x8f), currency symbol MON, RPC URL from `NEXT_PUBLIC_MONAD_RPC_URL`, and block explorers `https://monadvision.com` and `https://monadscan.com`.
2. WHEN a user connects a wallet that does not have chainId 143 configured, THE Frontend SHALL prompt the wallet to add the network via `wallet_addEthereumChain`.
3. THE Frontend SHALL support MetaMask and WalletConnect v2.
4. THE Frontend SHALL display pending transaction state immediately after submission and update to confirmed state upon block inclusion.

---

### Requirement 16: Frontend Pages and Navigation

**User Story:** As a user, I want a complete set of pages covering the full poster and worker lifecycle, so that I can use the platform without leaving the app.

#### Acceptance Criteria

1. THE Frontend SHALL provide a public task feed page at `/` that lists all open tasks read from on-chain events.
2. THE Frontend SHALL provide a task detail page at `/tasks/[id]` showing task metadata, all bids, and the deliverable if submitted.
3. THE Frontend SHALL provide a task creation page at `/tasks/create` accessible only to connected wallets.
4. THE Frontend SHALL provide a worker profile page at `/profile/[address]` showing registration status and task history.
5. THE Frontend SHALL provide a dashboard page at `/dashboard` showing the connected wallet's active tasks (as poster) and active bids (as worker).
6. THE Frontend SHALL use Next.js 14 App Router with Tailwind CSS for styling.

---

### Requirement 17: Contract Architecture and Deployment

**User Story:** As a developer, I want a clean Foundry project structure with both contracts deployable via a single script, so that the deployment is reproducible and verifiable.

#### Acceptance Criteria

1. THE TaskEscrow SHALL accept `address registry` and `address admin` as constructor arguments and store them immutably (registry) and mutably (admin, for two-step transfer).
2. THE WorkerRegistry SHALL be deployed before TaskEscrow; the Deploy script SHALL pass WorkerRegistry's address to TaskEscrow's constructor.
3. THE Foundry project SHALL include fuzz tests for balance integrity, reentrancy on `withdraw()`, state machine transitions, timeout paths, the `MAX_TASK_VALUE` cap, and admin-only access control.
4. THE Deploy script SHALL log deployed contract addresses and export ABIs to `frontend/src/abi/`.
5. THE TaskEscrow SHALL use Solidity `^0.8.24` and import OpenZeppelin's `ReentrancyGuard`.
6. THE GitHub repository SHALL be initialised at `https://github.com/DevAnuragT/Gig.git`.

---

## Non-Functional Requirements

### NFR-01 · Task Value Cap
THE TaskEscrow SHALL enforce `MAX_TASK_VALUE = 1 ether` and revert any `createTask` call where `msg.value > MAX_TASK_VALUE`.

### NFR-02 · Reentrancy Safety
THE TaskEscrow SHALL apply `ReentrancyGuard` to `withdraw()`, `reclaimAfterTimeout()`, and `claimAfterReviewTimeout()`, and SHALL use the pull-payment pattern for all ETH transfers.

### NFR-03 · Gas Efficiency on Monad
THE TaskEscrow SHALL store task state as a `uint8` enum, store bids as a `mapping(uint256 => mapping(address => Bid))`, and emit events with sufficient indexed data so the frontend requires no backend.

### NFR-04 · Frontend Performance
THE Frontend SHALL load the task feed in under 2 seconds on Monad testnet and SHALL fetch IPFS metadata lazily on task card expand.

### NFR-05 · No Backend Dependency
THE Frontend SHALL read all data from Monad RPC and IPFS gateway only; no centralised database or server-side API is required.

### NFR-06 · Browser Wallet Support
THE Frontend SHALL support MetaMask and WalletConnect v2 and SHALL auto-add Monad testnet (chainId 143) on first connect.

---

## Out of Scope for MVP

| Feature | Reason deferred |
|---|---|
| ReputationRegistry.sol | Requires historical data volume to be meaningful |
| DisputeResolver.sol | Admin override covers edge cases at MVP scale |
| Milestone payments | Adds contract complexity; handle post-traction |
| Streaming payments | Requires StreamPayment.sol; not needed for task-based work |
| Soulbound NFT badges | Depends on reputation system |
| Protocol governance token | Premature without user base |
| Cross-chain bridge | Monad-only is sufficient for MVP |
| AI matching engine | Nice-to-have; manual search is fine at small scale |
| Team / squad tasks | Single-worker only for MVP |

---

## Acceptance Criteria (MVP Shippable)

1. A poster can create a task with escrowed funds on Monad testnet (chainId 143) end-to-end.
2. A worker can register, bid, be assigned, submit a deliverable, and receive payment via `withdraw()`.
3. Poster timeout reclaim (`reclaimAfterTimeout`) and worker auto-claim (`claimAfterReviewTimeout`) work correctly.
4. `cancelTask` by poster on an OPEN task refunds via pull-payment ledger.
5. Two-step `transferAdmin` (propose → accept) works and emits `NewAdminProposed`.
6. `MAX_TASK_VALUE` cap is enforced and covered by Foundry fuzz tests.
7. Reentrancy attack on `withdraw()` fails in Foundry fuzzing.
8. Frontend loads task feed from on-chain events without a backend or API key.
9. Admin override is functional and emits `AdminOverride` event.
10. nft.storage HTTP API is used for all IPFS uploads; no web3.storage w3up client.
