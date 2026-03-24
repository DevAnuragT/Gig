// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/WorkerRegistry.sol";
import "../src/TaskEscrow.sol";
import "./DeployConfig.s.sol";

/**
 * @title Deploy
 * @notice Deploys WorkerRegistry and TaskEscrow to the configured network.
 *
 * Usage:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $MONAD_RPC_URL \
 *     --broadcast \
 *     --verify
 *
 * Required env vars: PRIVATE_KEY, ADMIN_ADDRESS
 */
contract Deploy is DeployConfig {
    function run() public {
        _loadConfig();

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy WorkerRegistry (no constructor args)
        WorkerRegistry workerRegistry = new WorkerRegistry();
        console.log("WorkerRegistry deployed at:", address(workerRegistry));

        // 2. Deploy TaskEscrow (requires registry + admin)
        TaskEscrow taskEscrow = new TaskEscrow(
            address(workerRegistry),
            adminAddress
        );
        console.log("TaskEscrow deployed at:", address(taskEscrow));

        vm.stopBroadcast();

        // --- Output summary for easy copy-paste ---
        console.log("");
        console.log("============================================");
        console.log("  DEPLOYMENT COMPLETE");
        console.log("============================================");
        console.log("");
        console.log("Add these to your .env / frontend .env.local:");
        console.log("");
        console.log("  NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS=", address(workerRegistry));
        console.log("  NEXT_PUBLIC_TASK_ESCROW_ADDRESS=", address(taskEscrow));
        console.log("");
        console.log("  WORKER_REGISTRY_ADDRESS=", address(workerRegistry));
        console.log("  TASK_ESCROW_ADDRESS=", address(taskEscrow));
        console.log("");
        console.log("  Admin:", adminAddress);
        console.log("============================================");
    }
}
