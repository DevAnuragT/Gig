// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

/**
 * @title DeployConfig
 * @notice Shared configuration for deploy and verify scripts.
 *         Reads and validates required environment variables.
 */
contract DeployConfig is Script {
    uint256 public deployerPrivateKey;
    address public deployer;
    address public adminAddress;

    function _loadConfig() internal {
        // --- Private key ---
        try vm.envUint("PRIVATE_KEY") returns (uint256 pk) {
            deployerPrivateKey = pk;
        } catch {
            revert("DeployConfig: PRIVATE_KEY env var is required");
        }

        deployer = vm.addr(deployerPrivateKey);
        require(deployer != address(0), "DeployConfig: derived deployer is zero address");

        // --- Admin address ---
        try vm.envAddress("ADMIN_ADDRESS") returns (address admin) {
            adminAddress = admin;
        } catch {
            revert("DeployConfig: ADMIN_ADDRESS env var is required");
        }

        require(adminAddress != address(0), "DeployConfig: ADMIN_ADDRESS must not be zero");

        console.log("=== Deploy Configuration ===");
        console.log("  Deployer:", deployer);
        console.log("  Admin:   ", adminAddress);
        console.log("============================");
    }
}
