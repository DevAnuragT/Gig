// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/WorkerRegistry.sol";
import "../src/TaskEscrow.sol";

/**
 * @title Verify
 * @notice Helper script to log verification commands for deployed contracts.
 *
 * After deployment, run this script to get the exact forge commands
 * needed to verify both contracts on the block explorer.
 *
 * Usage:
 *   forge script script/Verify.s.sol
 *
 * Required env vars:
 *   WORKER_REGISTRY_ADDRESS, TASK_ESCROW_ADDRESS, ADMIN_ADDRESS, MONAD_RPC_URL
 */
contract Verify is Script {
    function run() public view {
        address registryAddr = vm.envAddress("WORKER_REGISTRY_ADDRESS");
        address escrowAddr   = vm.envAddress("TASK_ESCROW_ADDRESS");
        address adminAddr    = vm.envAddress("ADMIN_ADDRESS");

        require(registryAddr != address(0), "WORKER_REGISTRY_ADDRESS not set");
        require(escrowAddr   != address(0), "TASK_ESCROW_ADDRESS not set");
        require(adminAddr    != address(0), "ADMIN_ADDRESS not set");

        console.log("============================================");
        console.log("  CONTRACT VERIFICATION COMMANDS");
        console.log("============================================");
        console.log("");
        console.log("1. Verify WorkerRegistry:");
        console.log("   forge verify-contract \\");
        console.log("     ", registryAddr);
        console.log("     src/WorkerRegistry.sol:WorkerRegistry \\");
        console.log("     --chain-id 10143 \\");
        console.log("     --watch");
        console.log("");
        console.log("2. Verify TaskEscrow:");
        console.log("   forge verify-contract \\");
        console.log("     ", escrowAddr);
        console.log("     src/TaskEscrow.sol:TaskEscrow \\");
        console.log("     --constructor-args $(cast abi-encode 'constructor(address,address)'", registryAddr, adminAddr, ") \\");
        console.log("     --chain-id 10143 \\");
        console.log("     --watch");
        console.log("");
        console.log("============================================");
        console.log("  BLOCK EXPLORER LINKS");
        console.log("============================================");
        console.log("");
        console.log("  WorkerRegistry: https://testnet.monadexplorer.com/address/", registryAddr);
        console.log("  TaskEscrow:     https://testnet.monadexplorer.com/address/", escrowAddr);
        console.log("");
    }
}
