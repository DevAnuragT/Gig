# ============================================================================
# Gig Platform — Contracts Makefile
# ============================================================================
# Prerequisites: foundry (forge, cast), .env file with required variables
# ============================================================================

-include .env

# --- Defaults ---
RPC_URL     ?= $(MONAD_RPC_URL)
CHAIN_ID    ?= 10143

# ============================================================================
# Core Targets
# ============================================================================

.PHONY: build test deploy verify export-abi deploy-all clean help

## Build contracts
build:
	forge build

## Run all tests with verbose output
test:
	forge test -vv

## Run tests with gas report
test-gas:
	forge test -vv --gas-report

## Deploy contracts to Monad testnet
deploy:
	@echo "==> Deploying to Monad Testnet ($(RPC_URL))..."
	forge script script/Deploy.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		-vvvv
	@echo "==> Deployment complete. Update .env with the deployed addresses."

## Deploy and verify in one step
deploy-verify:
	@echo "==> Deploying and verifying on Monad Testnet..."
	forge script script/Deploy.s.sol \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--verify \
		-vvvv
	@echo "==> Deploy + verify complete."

## Verify already-deployed contracts on block explorer
verify: verify-registry verify-escrow

verify-registry:
	@echo "==> Verifying WorkerRegistry at $(WORKER_REGISTRY_ADDRESS)..."
	forge verify-contract \
		$(WORKER_REGISTRY_ADDRESS) \
		src/WorkerRegistry.sol:WorkerRegistry \
		--rpc-url $(RPC_URL) \
		--chain-id $(CHAIN_ID) \
		--watch

verify-escrow:
	@echo "==> Verifying TaskEscrow at $(TASK_ESCROW_ADDRESS)..."
	forge verify-contract \
		$(TASK_ESCROW_ADDRESS) \
		src/TaskEscrow.sol:TaskEscrow \
		--rpc-url $(RPC_URL) \
		--chain-id $(CHAIN_ID) \
		--constructor-args $$(cast abi-encode "constructor(address,address)" $(WORKER_REGISTRY_ADDRESS) $(ADMIN_ADDRESS)) \
		--watch

## Export ABIs to frontend/abi/
export-abi:
	@echo "==> Exporting ABIs..."
	@mkdir -p ../frontend/abi
	forge inspect src/TaskEscrow.sol:TaskEscrow abi > ../frontend/abi/TaskEscrow.json
	forge inspect src/WorkerRegistry.sol:WorkerRegistry abi > ../frontend/abi/WorkerRegistry.json
	@echo "==> ABIs exported to frontend/abi/"

## Full pipeline: test → deploy → export ABI
deploy-all: test deploy export-abi
	@echo "==> Full deployment pipeline complete!"

## Print verification commands (dry-run)
verify-info:
	forge script script/Verify.s.sol -vvvv

## Remove build artifacts
clean:
	forge clean

## Show help
help:
	@echo "Available targets:"
	@echo "  make build          - Compile contracts"
	@echo "  make test           - Run tests (verbose)"
	@echo "  make test-gas       - Run tests with gas report"
	@echo "  make deploy         - Deploy to Monad testnet"
	@echo "  make deploy-verify  - Deploy + verify in one step"
	@echo "  make verify         - Verify deployed contracts"
	@echo "  make export-abi     - Export ABIs to frontend/"
	@echo "  make deploy-all     - test -> deploy -> export-abi"
	@echo "  make verify-info    - Print verification commands"
	@echo "  make clean          - Remove build artifacts"
	@echo ""
	@echo "Required .env variables:"
	@echo "  PRIVATE_KEY, ADMIN_ADDRESS, MONAD_RPC_URL"
	@echo ""
	@echo "For verification:"
	@echo "  WORKER_REGISTRY_ADDRESS, TASK_ESCROW_ADDRESS, ETHERSCAN_API_KEY"
