// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/WorkerRegistry.sol";
import "../src/TaskEscrow.sol";

contract Deploy is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy WorkerRegistry first
        WorkerRegistry workerRegistry = new WorkerRegistry();
        console.log("WorkerRegistry deployed at:", address(workerRegistry));

        // Deploy TaskEscrow with WorkerRegistry address
        TaskEscrow taskEscrow = new TaskEscrow(
            address(workerRegistry),
            admin
        );
        console.log("TaskEscrow deployed at:", address(taskEscrow));

        vm.stopBroadcast();

        // Output addresses for frontend
        console.log("\n--- Deployment Complete ---");
        console.log("NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS=", address(workerRegistry));
        console.log("NEXT_PUBLIC_TASK_ESCROW_ADDRESS=", address(taskEscrow));
        console.log("Admin Address:", admin);
    }
}
