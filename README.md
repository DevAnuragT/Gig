# Gig Platform MVP

A decentralized gig marketplace built on Monad testnet, enabling transparent task posting, bidding, delivery, and payment through smart contracts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                    │
├─────────────────────────────────────────────────────────────┤
│ Pages: /tasks/create, /tasks/[id], /profile, /dashboard     │
│ Components: BidForm, DeliverableForm, TaskCard, etc.        │
│            Hooks: useTaskDetail, useTaskBids, etc.          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│          Web3 Integration (wagmi v2, viem, ethers)           │
├─────────────────────────────────────────────────────────────┤
│ • Event watching (TaskCreated, BidSubmitted, etc.)          │
│ • Contract interaction (read/write)                          │
│ • Connected wallet management                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         Smart Contracts (Solidity 0.8.24 on Monad)           │
├─────────────────────────────────────────────────────────────┤
│ • WorkerRegistry: Registration + skill bitmasks             │
│ • TaskEscrow: Full task lifecycle + pull-payment ledger     │
│ • ReentrancyGuard: Protection on all payout functions       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Foundry (for smart contracts)
- MetaMask or compatible Web3 wallet
- MON tokens on Monad testnet

### Installation

```bash
# Clone repository
git clone <repo-url>
cd monadblitz

# Install contract dependencies
cd contracts
forge install

# Install frontend dependencies
cd ../frontend
npm install
```

## Project Structure

```
monadblitz/
├── contracts/                 # Smart contracts
│   ├── src/
│   │   ├── WorkerRegistry.sol      # Worker registration & skills
│   │   ├── TaskEscrow.sol          # Task escrow & state machine
│   │   └── interfaces/
│   ├── test/
│   │   ├── WorkerRegistry.t.sol    # Property-based tests (4 tests)
│   │   └── TaskEscrow.t.sol        # Property-based tests (17 tests)
│   └── script/
│       └── Deploy.s.sol            # Deployment script
│
├── frontend/                  # Next.js frontend
│   ├── app/
│   │   ├── page.tsx              # Task feed (/)
│   │   ├── dashboard/page.tsx     # Pointer/worker dashboard
│   │   ├── profile/[address]/     # Worker profile
│   │   └── tasks/
│   │       ├── create/page.tsx    # Task creation
│   │       └── [id]/page.tsx      # Task details
│   ├── src/
│   │   ├── lib/
│   │   │   ├── wagmi.ts           # wagmi chain config
│   │   │   ├── contracts.ts       # Contract ABI & address exports
│   │   │   ├── ipfs.ts            # IPFS upload/fetch utilities
│   │   │   └── taskDetailHooks.ts # Task detail reading hooks
│   │   └── components/
│   │       ├── ConnectButton.tsx  # Wallet connection
│   │       ├── BidForm.tsx        # Bid submission form
│   │       ├── DeliverableForm.tsx# Deliverable submission form
│   │       ├── TaskCard.tsx       # Task display card
│   │       └── ...
│   └── abi/
│       ├── TaskEscrow.json        # Contract ABI
│       └── WorkerRegistry.json
│
├── design.md                  # Design specification
├── requirements.md            # Requirements document
└── DEPLOYMENT.md             # Deployment instructions
```

## Smart Contract API

### WorkerRegistry

```solidity
// Register as a worker
function registerWorker(bytes32 nameHash, uint64 skillBitmask)

// Update skills (registered workers only)
function updateSkills(uint64 skillBitmask)

// Read worker data
function workers(address worker) returns (bytes32 nameHash, uint64 skillBitmask, bool registered)
```

**Skills (bit positions 0-7)**:
- 0: Smart Contract Development
- 1: Frontend Development
- 2: Backend Development
- 3: UI/UX Design
- 4: Security Audit
- 5: Technical Writing
- 6: Data Labeling
- 7: QA/Testing

### TaskEscrow

```solidity
// Poster: Create task with escrow deposit
function createTask(string metadataCid, uint64 deadline) payable

// Worker: Submit bid (must be registered)
function submitBid(uint256 taskId, string proposalCid, uint256 price)

// Poster: Assign worker to task
function assignWorker(uint256 taskId, uint256 bidId)

// Worker: Submit deliverable
function submitDeliverable(uint256 taskId, string deliveryCid)

// Poster: Approve deliverable and release payment
function approveAndRelease(uint256 taskId)

// Poster: Cancel task (refunds via pull-payment ledger)
function cancelTask(uint256 taskId)

// Payment withdrawal (pull-payment pattern)
function withdraw()

// Fallback mechanisms
function reclaimAfterTimeout(uint256 taskId)        // After deadline passes
function claimAfterReviewTimeout(uint256 taskId)    // After 7-day review window

// Admin functions
function proposeAdmin(address newAdmin)
function acceptAdmin()
function adminCancel(uint256 taskId)
```

**Task States**: OPEN → ASSIGNED → REVIEW → CLOSED

## Frontend Pages

### Task Feed `/`
- Displays all available tasks as cards
- Client-side filtering by budget and deadline range
- Click to view task details

### Task Details `/tasks/[id]`
- View full task description and metadata
- Submit bids (for registered workers)
- View list of submitted bids
- Submit deliverable (if assigned as worker)
- Approve & release payment (if poster)
- Task state badge and timeline

### Create Task `/tasks/create`
- Form to create new task
- Upload metadata (title, description, skills) to nft.storage
- Set budget (≤ 1 MON) and deadline
- Select required skills (multi-checkbox)
- Transaction confirmation

### Worker Profile `/profile/[address]`
- Display worker registration status
- View skills if registered
- Registration form (display name, bio, skills) → calls `registerWorker()`
- Update skills form (if already registered)
- Profile accessible to all; edit form visible only to owner

### Dashboard `/dashboard`
- **My Tasks (Poster)**: View tasks you posted
- **My Bids (Worker)**: View bids you submitted with status
- **Withdrawals**: View pending balance and withdraw funds
- Wallet connection required

## Testing

### Run Smart Contract Tests

```bash
cd contracts

# Run all tests
forge test

# Run with verbose output and fuzz seed
forge test -vvv --fuzz-seed 123

# Run specific test file
forge test --match-path test/TaskEscrow.t.sol

# Run with specific number of fuzz runs
forge test --fuzz-runs 1000
```

### Test Coverage

**WorkerRegistry.t.sol** (4 tests):
- Worker registration round-trip
- Double registration prevention
- Skill updates round-trip
- Skill updates by unregistered user reverts

**TaskEscrow.t.sol** (17 tests):
- Task creation validation and round-trip
- Bid submission (registration gate, price cap, round-trip)
- Task assignment requirements
- Cancellation with refunds
- Deliverable submission and review deadlines
- Payment release and withdrawal
- Pull-payment ledger integrity
- Timeout enforcement (deadline and review window)
- Admin two-step transfer
- Reentrancy protection on withdrawals

## IPFS Metadata Format

### Task Metadata
```json
{
  "version": "1.0",
  "title": "Smart Contract Audit",
  "description": "Need a security audit of my ERC-20 token contract",
  "skills": [4, 6]  // Security Audit, Data Labeling
}
```

### Bid Metadata
```json
{
  "version": "1.0",
  "proposal": "I can perform a thorough security audit within 2 weeks..."
}
```

### Worker Profile Metadata
```json
{
  "version": "1.0",
  "displayName": "Alice Chen",
  "bio": "10+ years of Solidity development and security auditing"
}
```

### Deliverable Metadata
```json
{
  "version": "1.0",
  "summary": "Audit completed, 3 critical vulnerabilities found",
  "notes": "See attached report for detailed findings..."
}
```

## Configuration

### Frontend Environment (`.env.local`)

```bash
# Contract addresses (obtained from deployment)
NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_TASK_ESCROW_ADDRESS=0x...

# IPFS API key (get from https://nft.storage)
NEXT_PUBLIC_NFTSTORAGE_API_KEY=your_key_here
```

### Deploy Environment (`contracts/.env`)

```bash
PRIVATE_KEY=0x...                           # Deployment wallet
ADMIN_ADDRESS=0x...                         # Task admin
RPC_URL=https://testnet-rpc.monad.xyz/     # Monad RPC
```

## Key Features Implemented

✅ **Smart Contract Security**
- Reentrancy guards on all payouts
- State machine validation
- Timeout enforcement
- Two-step admin transfer

✅ **User Experience**
- Wallet connection with network auto-configuration
- IPFS metadata upload with nft.storage
- Real-time event watching for dynamic updates
- Form validation with helpful error messages

✅ **MVP Completeness**
- Full task lifecycle (create → bid → assign → deliver → approve → withdraw)
- Worker registration and skill management
- Pull-payment ledger for secure payouts
- Admin fallback cancel function

✅ **Testing & Validation**
- 21 comprehensive property-based tests
- 256 fuzz runs per test for edge case coverage
- 100% contract test pass rate

## Gas Costs (Approximate)

| Operation | Gas | Notes |
|-----------|-----|-------|
| registerWorker | 60K | One-time worker registration |
| createTask | 170K | IPFS CID storage |
| submitBid | 250K | Event emission + state update |
| assignWorker | 145K | Bid acceptance |
| submitDeliverable | 300K | Deadline calculation |
| approveAndRelease | 290K | Pull-payment ledger credit |
| withdraw | 300K | Fund transfer with safety checks |

**Total for complete flow**: ~1.5M gas

## Common Workflows

### Poster Workflow
1. Connect wallet at `/`
2. Create task at `/tasks/create` (upload title/description)
3. View task details at `/tasks/[id]`
4. Assign worker to a bid
5. Review deliverable
6. Approve and release payment
7. Check withdrawal balance in dashboard

### Worker Workflow
1. Connect wallet and register at `/profile/<your_address>`
2. Select skills during registration
3. Browse tasks on `/` task feed
4. Submit bid on task details page
5. If assigned, submit deliverable
6. After approval, withdraw funds from dashboard

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step Monad testnet deployment instructions.

## Known Limitations & Future Work

### Current MVP Scope
- Single-chain (Monad testnet only)
- Direct wallet connection (no external connectors)
- In-memory event indexing (no persistent database)
- Basic skill matching (no advanced filtering)

### Future Enhancements
- Task recommendation engine
- Reputation and rating system
- Escrow multi-sig approval
- Direct messaging between users
- Task badges and categories
- Price negotiation before assignment

## Security Considerations

- **Private Keys**: Store in environment files, never commit to git
- **IPFS CIDs**: Assume immutable; verify metadata on-chain if needed
- **Contract Upgrades**: Current contracts are not upgradeable (storage immutability)
- **Reentrancy**: Protected via ReentrancyGuard on all fund transfers

## Support & Feedback

For issues or feature requests:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section
2. Review contract ABIs in `frontend/abi/`
3. Check test files for usage examples

## License

MIT License - See project root for details
