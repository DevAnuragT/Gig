# Gig Platform MVP - Deployment Guide

## Project Status ✅

### Completed Components
- **Smart Contracts** (21/21 tests passing)
  - `WorkerRegistry.sol` - Worker registration and skills management
  - `TaskEscrow.sol` - Task lifecycle, escrow, pull-payment ledger
  - Comprehensive property-based tests with 256 fuzz runs per test

- **Frontend Pages** (All building successfully)
  - `/` - Task feed with client-side filtering
  - `/tasks/[id]` - Task details with bid submission and deliverable upload
  - `/tasks/create` - Task creation with form validation and IPFS upload
  - `/profile/[address]` - Worker profile with registration and skills management
  - `/dashboard` - Pointer/worker dashboard with bid tracking and withdrawals

- **Core Infrastructure**
  - Wagmi v2 configuration for Monad testnet (chainId=143, MON native currency)
  - IPFS integration (nft.storage for upload, Cloudflare gateway for fetch)
  - Contract bindings and ABI exports
  - Reusable React components (ConnectButton, TaskCard, BidForm, etc.)

## Prerequisites

Before deploying to Monad testnet, ensure you have:

```bash
# 1. Foundry installed
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Node.js 18+ and npm installed
node --version
npm --version

# 3. MON tokens on testnet (request from faucet)
# https://testnet.monadexplorer.com/ → Faucet
```

## Environment Setup

Create a `.env` file in the `contracts/` directory:

```bash
# Private key of deployment account (with MON balance for gas)
PRIVATE_KEY=0x...

# Admin address (can manage tasks, cancel as fallback)
ADMIN_ADDRESS=0x...

# RPC endpoint for Monad testnet
RPC_URL=https://testnet-rpc.monad.xyz/
```

Create a `.env.local` file in the `frontend/` directory:

```bash
# Contract addresses (output from deployment script)
NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_TASK_ESCROW_ADDRESS=0x...

# IPFS pinning service API key
NEXT_PUBLIC_NFTSTORAGE_API_KEY=your_nft_storage_api_key
```

## Deployment Steps

### 1. Deploy Smart Contracts

```bash
cd contracts

# Verify contracts compile
forge compile

# Run tests to ensure correctness
forge test -vv

# Deploy to Monad testnet
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# Expected output:
# WorkerRegistry deployed at: 0x...
# TaskEscrow deployed at: 0x...
```

### 2. Export Contract ABIs (Optional)

If you need to regenerate ABIs with correct formatting:

```bash
# Export TaskEscrow ABI
forge inspect src/TaskEscrow.sol:TaskEscrow abi > ../frontend/abi/TaskEscrow.json

# Export WorkerRegistry ABI
forge inspect src/WorkerRegistry.sol:WorkerRegistry abi > ../frontend/abi/WorkerRegistry.json
```

### 3. Update Frontend Environment

Copy the deployed addresses from step 1 into `frontend/.env.local`:

```bash
NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS=0x<deployed_registry_address>
NEXT_PUBLIC_TASK_ESCROW_ADDRESS=0x<deployed_escrow_address>
NEXT_PUBLIC_NFTSTORAGE_API_KEY=<your_api_key>
```

### 4. Build and Deploy Frontend

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Build for production
npm run build

# Deploy to hosting service (Vercel, Netlify, etc.)
vercel --prod  # If using Vercel
# or
netlify deploy --prod  # If using Netlify
```

## Testing the MVP

### Local Testing (Before Mainnet)

1. **Start local Foundry testnet** (optional):
   ```bash
   anvil --fork-url $RPC_URL
   ```

2. **Run property-based tests**:
   ```bash
   cd contracts
   forge test -vv --fuzz-runs 1000
   ```

### E2E Flow on Testnet

1. **Register a worker**:
   - Navigate to `/profile/<your_address>`
   - Enter display name and bio
   - Select skills
   - Click "Register"

2. **Create a task**:
   - Navigate to `/tasks/create`
   - Enter title, description, budget (≤1 MON), deadline
   - Select required skills
   - Click "Create Task"

3. **Submit a bid**:
   - As a different user, navigate to `/` to see tasks
   - Click on the task
   - Enter proposal text and price (≤ budget)
   - Click "Submit Bid"

4. **Assign worker**:
   - As the poster, go to the task detail page
   - Click "Assign Worker" on the accepted bid

5. **Submit deliverable**:
   - As the assigned worker, go to the task detail page
   - Enter summary and notes in the "Submit Deliverable" form
   - Click "Submit"

6. **Approve and release payment**:
   - As the poster, click "Approve & Release Payment"
   - Funds credited to worker's withdrawal ledger

7. **Withdraw funds**:
   - Go to `/dashboard`
   - Click "Withdrawals" tab
   - Click "Withdraw" to claim funds

## Key Technical Details

### SmartContract Architecture

**WorkerRegistry**:
- Hash-based identity: `keccak256(displayName+bio)` → name hash
- Skill bitmask: 8 defined skills (bits 0-7), 56 reserved
- Updates allowed by registered workers only

**TaskEscrow**:
- State machine: OPEN → ASSIGNED → REVIEW → CLOSED/CANCELLED
- Pull-payment ledger: `pendingWithdrawals[address]` mapping
- Reentrancy protection: ReentrancyGuard on all payout functions
- Timeout enforcement:
  - `reclaimAfterTimeout()` after task deadline
  - `claimAfterReviewTimeout()` after 7-day review window

### Frontend Architecture

**Event-driven updates**:
- `useWatchContractEvent` for TaskCreated, BidSubmitted events
- In-memory task store with client-side filtering

**Custom hooks** (see `src/lib/taskDetailHooks.ts`):
- `useTaskDetail(taskId)` - read task state
- `useTaskBids(taskId)` - filter bids for task
- `useTaskMetadata(cid)` - lazy-fetch from IPFS
- `useIsWorkerRegistered(address)` - check registration

**Form validation**:
- Budget ≤ 1 MON cap
- Deadline in future
- Price validation vs. budget
- Required fields checked before submission

## Contract Constants

| Constant | Value | Notes |
|----------|-------|-------|
| MAX_TASK_VALUE | 1 ether | Maximum task budget |
| REVIEW_WINDOW | 7 days | Post-deliverable review period |
| Skill Bits | 0-7 (8 defined) | See `SKILL_NAMES` in frontend |

## Gas Considerations

**Estimated gas costs** (on Monad testnet):
- `registerWorker()` - ~60K gas
- `createTask()` - ~170K gas
- `submitBid()` - ~250K gas
- `assignWorker()` - ~145K gas
- `submitDeliverable()` - ~300K gas
- `approveAndRelease()` - ~290K gas
- `withdraw()` - ~300K gas

**Total for complete flow**: ~1.5M gas

## Troubleshooting

### Issue: "Worker not registered" error on bid submission
**Solution**: Register the worker first at `/profile/<your_address>`

### Issue: IPFS upload fails with 401
**Solution**: Check `NEXT_PUBLIC_NFTSTORAGE_API_KEY` in `frontend/.env.local`

### Issue: Transaction reverts with "Deadline passed"
**Solution**: Ensure deadline timestamp is in the future (set deadline > current time)

### Issue: "Task value exceeds max" error
**Solution**: Ensure task budget ≤ 1 MON (1000000000000000000 wei)

## Next Steps

1. **Monitoring & Analytics**:
   - Add event logging for task lifecycle
   - Track gas costs and user flow

2. **Additional Features** (Post-MVP):
   - Task escrow multi-sig approval
   - Reputation/rating system
   - Advanced filtering (skill matching, price range)
   - Direct messaging between poster and worker

3. **Security Audit**:
   - External audit of smart contracts
   - Frontend security review (IPFS metadata validation, XSS prevention)

## Support Resources

- **Monad Documentation**: https://docs.monad.xyz/
- **Foundry Book**: https://book.getfoundry.sh/
- **wagmi Docs**: https://wagmi.sh/
- **nft.storage**: https://nft.storage/docs/
