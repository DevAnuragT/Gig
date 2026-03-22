# MVP Requirements — Decentralized Gig Platform on Monad

## Scope

Single-contract, single-flow MVP. A poster locks funds, a worker completes the task, payment is released trustlessly. No reputation scoring, no arbitration pool, no token.

---

## Functional Requirements

### FR-01 · Task creation
- Poster connects wallet (EIP-4361 SIWE)
- Poster fills a form: title, description, required skills, budget (ETH), deadline (timestamp)
- Frontend pins metadata JSON to IPFS via web3.storage, receives a CID
- Frontend calls `createTask(cid, deadline)` with ETH value equal to budget
- Contract locks funds and emits `TaskCreated(taskId, poster, cid, budget, deadline)`
- Task appears on the public task board immediately (event-indexed)

### FR-02 · Task discovery
- Unauthenticated users can browse all open tasks
- Tasks are read from on-chain events — no backend database
- Filter by: skill tag bitmask, minimum budget, deadline range
- Each task card shows: title (from IPFS), budget, deadline, poster address (truncated)

### FR-03 · Bid submission
- Any registered worker can submit a bid on an OPEN task
- Bid contains: proposed price (≤ task budget), estimated delivery time, short proposal (IPFS CID)
- Contract stores bid on-chain: `submitBid(taskId, proposalCid, proposedPrice)`
- Poster sees all bids on the task detail page

### FR-04 · Worker assignment
- Poster reviews bids and calls `assignWorker(taskId, workerAddress)`
- Task state transitions OPEN → ASSIGNED
- All other bidders' bids are invalidated (no gas refund needed at MVP)
- Assigned worker is notified via on-chain event `WorkerAssigned(taskId, worker)`

### FR-05 · Deliverable submission
- Assigned worker pins deliverable to IPFS, gets CID
- Worker calls `submitDeliverable(taskId, deliverableCid)`
- Task state transitions ASSIGNED → REVIEW
- Poster is notified via event `DeliverableSubmitted(taskId, deliverableCid)`

### FR-06 · Payment release
- Poster reviews deliverable (fetched from IPFS via CID)
- Poster calls `approveAndRelease(taskId)`
- Task state transitions REVIEW → CLOSED
- Worker receives full escrowed amount via pull-payment
- Worker calls `withdraw()` to claim their balance
- Event emitted: `PaymentReleased(taskId, worker, amount)`

### FR-07 · Timeout — worker no-show
- If task is ASSIGNED and deadline passes with no deliverable, poster calls `reclaimAfterTimeout(taskId)`
- Contract verifies `block.timestamp > deadline` and state is ASSIGNED
- Escrowed funds returned to poster
- Task state transitions to CANCELLED

### FR-08 · Timeout — poster no-review
- If task is in REVIEW state and poster has not approved within REVIEW_WINDOW (7 days), worker calls `claimAfterReviewTimeout(taskId)`
- Payment automatically released to worker
- Protects workers from silent posters

### FR-09 · Worker registration
- Worker connects wallet and calls `registerWorker(nameHash, skillBitmask)`
- `nameHash` is keccak256 of a display name stored in IPFS profile JSON
- `skillBitmask` encodes up to 64 skill categories as bit flags
- Registration is free (no stake required at MVP)

### FR-10 · Emergency admin override
- A deployer-controlled multisig address can call `adminCancel(taskId)` in cases of clear abuse
- Returns funds to poster, cancels task
- This function is documented publicly and commits to removal post-audit
- Emits `AdminOverride(taskId, reason)` for transparency

---

## Non-Functional Requirements

### NFR-01 · Task value cap
- `MAX_TASK_VALUE = 1 ether` enforced in contract
- Rejects any `createTask` call where `msg.value > MAX_TASK_VALUE`
- Rationale: limits blast radius during unaudited MVP phase

### NFR-02 · Reentrancy safety
- All payout functions use pull-payment pattern (balance ledger + `withdraw()`)
- `ReentrancyGuard` applied to `withdraw()`, `reclaimAfterTimeout()`, `claimAfterReviewTimeout()`
- No ETH is pushed directly to any address

### NFR-03 · Gas efficiency on Monad
- State machine stored as a single `uint8` enum per task
- Bids stored as a mapping, not an array, to avoid unbounded loops
- Events carry full indexable data so frontend never needs a backend

### NFR-04 · Frontend performance
- Task feed loads in < 2s on Monad testnet
- IPFS metadata fetched lazily (on task card expand, not on feed load)
- Wallet interactions show pending state immediately, confirm on block

### NFR-05 · No backend dependency
- All reads are from Monad RPC + IPFS gateway
- No centralised database, no API keys required to use the app
- web3.storage used for IPFS pinning (free tier sufficient for MVP)

### NFR-06 · Browser wallet support
- MetaMask and WalletConnect v2 supported
- Monad testnet chain config auto-added on first connect if not present

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

## Acceptance Criteria

The MVP is shippable when:

1. A poster can create a task with escrowed funds on Monad testnet end-to-end
2. A worker can register, bid, be assigned, submit deliverable, and receive payment
3. Timeout reclaim works correctly for both poster and worker paths
4. `MAX_TASK_VALUE` cap is enforced and tested
5. Reentrancy attack on `withdraw()` fails in Foundry fuzzing
6. Frontend loads task feed without a backend or API key
7. Admin override is functional and emits a logged event
