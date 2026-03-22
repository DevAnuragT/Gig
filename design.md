# Technical Design — Decentralized Gig Platform MVP

## Stack

| Layer | Technology | Reason |
|---|---|---|
| Chain | Monad testnet | Parallel EVM, 1s blocks, EVM-compatible |
| Smart contracts | Solidity ^0.8.24 | EVM standard |
| Contract tooling | Foundry | Fast fuzz testing, script-based deploy |
| Frontend framework | Next.js 14 (App Router) | SSG for task feed, RSC for IPFS fetch |
| Wallet / chain interaction | wagmi v2 + viem | Type-safe, hooks-based, WalletConnect built in |
| IPFS pinning | web3.storage (w3up client) | Free tier, CID-based, no API key for reads |
| Styling | Tailwind CSS | Utility-first, no runtime |

---

## Contract Design — TaskEscrow.sol

### State machine

```
OPEN → ASSIGNED → REVIEW → CLOSED
  ↓         ↓
CANCELLED  CANCELLED
```

Transitions:
- `createTask()` → OPEN
- `assignWorker()` → ASSIGNED (caller: poster)
- `submitDeliverable()` → REVIEW (caller: assigned worker)
- `approveAndRelease()` → CLOSED (caller: poster)
- `reclaimAfterTimeout()` → CANCELLED (caller: poster, requires deadline passed + state ASSIGNED)
- `claimAfterReviewTimeout()` → CLOSED (caller: worker, requires REVIEW_WINDOW passed)
- `adminCancel()` → CANCELLED (caller: admin multisig only)

### Data structures

```solidity
enum TaskState { OPEN, ASSIGNED, REVIEW, CLOSED, CANCELLED }

struct Task {
    address poster;
    address worker;           // zero until assigned
    string  metadataCid;      // IPFS CID of task JSON
    string  deliverableCid;   // IPFS CID set on submission
    uint256 budget;           // msg.value at creation
    uint64  deadline;         // unix timestamp
    uint64  reviewDeadline;   // set when REVIEW entered
    TaskState state;
}

mapping(uint256 => Task) public tasks;
uint256 public nextTaskId;

// Pull-payment ledger
mapping(address => uint256) public pendingWithdrawals;

// Bids: taskId => worker => proposalCid
mapping(uint256 => mapping(address => string)) public bids;
```

### Key constants

```solidity
uint256 public constant MAX_TASK_VALUE  = 1 ether;
uint64  public constant REVIEW_WINDOW   = 7 days;
```

### Function signatures

```solidity
// Poster actions
function createTask(string calldata metadataCid, uint64 deadline)
    external payable returns (uint256 taskId);

function assignWorker(uint256 taskId, address worker) external;

function approveAndRelease(uint256 taskId) external;

function reclaimAfterTimeout(uint256 taskId) external;

// Worker actions
function registerWorker(bytes32 nameHash, uint64 skillBitmask) external;

function submitBid(uint256 taskId, string calldata proposalCid, uint256 proposedPrice) external;

function submitDeliverable(uint256 taskId, string calldata deliverableCid) external;

function claimAfterReviewTimeout(uint256 taskId) external;

// Both
function withdraw() external nonReentrant;

// Admin
function adminCancel(uint256 taskId, string calldata reason) external onlyAdmin;
```

### Events

```solidity
event TaskCreated(uint256 indexed taskId, address indexed poster, string cid, uint256 budget, uint64 deadline);
event BidSubmitted(uint256 indexed taskId, address indexed worker, string proposalCid, uint256 proposedPrice);
event WorkerAssigned(uint256 indexed taskId, address indexed worker);
event DeliverableSubmitted(uint256 indexed taskId, string deliverableCid);
event PaymentReleased(uint256 indexed taskId, address indexed worker, uint256 amount);
event TaskCancelled(uint256 indexed taskId, address indexed refundedTo);
event AdminOverride(uint256 indexed taskId, string reason);
event WorkerRegistered(address indexed worker, bytes32 nameHash, uint64 skillBitmask);
```

### Security checklist

- `nonReentrant` on `withdraw()`, `reclaimAfterTimeout()`, `claimAfterReviewTimeout()`
- All ETH transfers via pull-payment ledger, never direct `.call{value: x}(worker)`
- State transitions validated with explicit `require(task.state == X)`
- `msg.sender == task.poster` checked before poster-only functions
- `msg.sender == task.worker` checked before worker-only functions
- `block.timestamp` used only for timeouts (not for randomness or ordering)
- `MAX_TASK_VALUE` enforced at `createTask` entry
- Admin address is an immutable set at deploy time, changeable only via explicit `transferAdmin()`

---

## Contract Design — WorkerRegistry.sol

Minimal. No scoring at MVP.

```solidity
struct Worker {
    bytes32 nameHash;       // keccak256 of display name
    uint64  skillBitmask;   // up to 64 skill categories
    bool    registered;
}

mapping(address => Worker) public workers;

function registerWorker(bytes32 nameHash, uint64 skillBitmask) external;
function updateSkills(uint64 skillBitmask) external;
function isRegistered(address worker) external view returns (bool);
```

Skill bitmask categories (first 16 defined at MVP):

| Bit | Skill |
|---|---|
| 0 | Smart contract development |
| 1 | Frontend development |
| 2 | Backend development |
| 3 | UI/UX design |
| 4 | Security audit |
| 5 | Technical writing |
| 6 | Data labeling |
| 7 | QA / testing |
| 8–63 | Reserved for future categories |

---

## IPFS Metadata Schemas

### Task metadata (posted by poster)

```json
{
  "version": "1.0",
  "title": "string",
  "description": "string (markdown)",
  "skills": [0, 1],
  "attachments": ["ipfs://CID"],
  "posterProfile": "ipfs://CID"
}
```

### Bid proposal (posted by worker)

```json
{
  "version": "1.0",
  "proposal": "string (markdown)",
  "deliveryDays": 3,
  "workerProfile": "ipfs://CID"
}
```

### Deliverable (posted by worker)

```json
{
  "version": "1.0",
  "summary": "string",
  "files": ["ipfs://CID"],
  "notes": "string"
}
```

### Worker profile (posted on registration)

```json
{
  "version": "1.0",
  "displayName": "string",
  "bio": "string",
  "github": "string",
  "twitter": "string",
  "portfolio": ["ipfs://CID"]
}
```

---

## Frontend Architecture

### Pages

```
/                    → Task feed (public, SSG refreshed every 30s)
/tasks/[id]          → Task detail + bids + deliverable
/tasks/create        → Create task form (wallet required)
/profile/[address]   → Worker profile + task history
/dashboard           → Poster's active tasks / Worker's active bids
```

### Data flow

```
Monad RPC
  └── getLogs(TaskCreated) → task index in-memory
  └── getLogs(BidSubmitted) → bids per task
  └── getTask(id) → contract read for fresh state

IPFS gateway (cloudflare-ipfs.com)
  └── fetch(cid) → task metadata JSON
  └── fetch(cid) → deliverable JSON
```

No backend. No database. The contract event log is the source of truth.

### wagmi contract config

```typescript
// lib/contracts.ts
export const TASK_ESCROW = {
  address: '0x...' as `0x${string}`,
  abi: TaskEscrowABI,
} as const

export const WORKER_REGISTRY = {
  address: '0x...' as `0x${string}`,
  abi: WorkerRegistryABI,
} as const
```

### Key hooks

```typescript
// Read open tasks from events
useWatchContractEvent({ ...TASK_ESCROW, eventName: 'TaskCreated' })

// Write: create task
useWriteContract() → writeContract({ ...TASK_ESCROW, functionName: 'createTask', args: [cid, deadline], value: budget })

// Read task state
useReadContract({ ...TASK_ESCROW, functionName: 'tasks', args: [taskId] })
```

### IPFS upload flow

```typescript
import { create } from '@web3-storage/w3up-client'

async function pinMetadata(metadata: object): Promise<string> {
  const client = await create()
  const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  const cid = await client.uploadFile(blob)
  return cid.toString()
}
```

---

## Foundry Project Structure

```
contracts/
  src/
    TaskEscrow.sol
    WorkerRegistry.sol
    interfaces/
      ITaskEscrow.sol
      IWorkerRegistry.sol
  test/
    TaskEscrow.t.sol        ← unit + fuzz tests
    TaskEscrowTimeout.t.sol ← timeout path tests
    WorkerRegistry.t.sol
  script/
    Deploy.s.sol            ← deploys both contracts, logs addresses
  foundry.toml
```

### Critical test cases

```solidity
// Fuzz: deposited funds always match ledger
function testFuzz_balanceIntegrity(uint96 amount) public { ... }

// Reentrancy: malicious worker contract cannot double-withdraw
function test_reentrancyOnWithdraw() public { ... }

// State machine: cannot skip REVIEW
function test_cannotReleaseFromAssigned() public { ... }

// Timeout: poster cannot reclaim before deadline
function test_reclaimBeforeDeadlineReverts() public { ... }

// Cap: task value above MAX_TASK_VALUE reverts
function test_exceedsCapReverts() public { ... }

// Admin: non-admin cannot call adminCancel
function test_adminCancelUnauthorizedReverts() public { ... }
```

---

## Deploy Sequence

```bash
# 1. Copy env
cp .env.example .env
# Set: PRIVATE_KEY, MONAD_RPC_URL, ADMIN_ADDRESS

# 2. Run tests
forge test -vv

# 3. Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url $MONAD_RPC_URL \
  --broadcast \
  --verify

# 4. Export ABIs for frontend
forge inspect TaskEscrow abi > frontend/src/abi/TaskEscrow.json
forge inspect WorkerRegistry abi > frontend/src/abi/WorkerRegistry.json

# 5. Paste deployed addresses into frontend/src/lib/contracts.ts
```

---

## Environment Variables

```bash
# .env.example

# Contracts
PRIVATE_KEY=0x...
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
ADMIN_ADDRESS=0x...          # multisig or deployer EOA at MVP

# Frontend (public)
NEXT_PUBLIC_TASK_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_CHAIN_ID=10143   # Monad testnet chain ID (confirm before deploy)

# IPFS
W3_STORAGE_KEY=...           # web3.storage API key
```

---

## MVP Definition of Done

| Checkpoint | Criteria |
|---|---|
| Contracts | All Foundry tests pass including fuzz and reentrancy |
| Contracts | Deployed and verified on Monad testnet |
| Frontend | Task feed loads from on-chain events, no backend |
| Frontend | Full poster flow: create → assign → approve works end-to-end |
| Frontend | Full worker flow: register → bid → deliver → withdraw works end-to-end |
| Frontend | Both timeout paths (poster reclaim, worker claim) trigger correctly |
| Security | `MAX_TASK_VALUE` enforced, reentrancy blocked, state machine validated |
| Docs | README with local setup instructions and testnet contract addresses |
