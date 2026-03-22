// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IWorkerRegistry.sol";

/// @title WorkerRegistry
/// @notice Stores worker registrations and skill bitmasks for the Gig platform.
/// @dev Skill bitmask bits 0-7 are defined; bits 8-63 are reserved.
///      Bit 0 = smart contract dev, 1 = frontend, 2 = backend, 3 = UI/UX,
///      4 = security audit, 5 = technical writing, 6 = data labeling, 7 = QA/testing.
contract WorkerRegistry is IWorkerRegistry {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Reverts when a wallet tries to register a second time.
    error AlreadyRegistered();

    /// @notice Reverts when an unregistered wallet calls a worker-only function.
    error NotRegistered();

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Worker {
        bytes32 nameHash;     // keccak256 of display name
        uint64  skillBitmask; // bits 0-7 defined, bits 8-63 reserved
        bool    registered;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    mapping(address => Worker) public workers;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event WorkerRegistered(address indexed worker, bytes32 nameHash, uint64 skillBitmask);

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Register the caller as a worker.
    /// @param nameHash   keccak256 of the worker's display name.
    /// @param skillBitmask Bitmask of skills (bits 0-7 defined).
    function registerWorker(bytes32 nameHash, uint64 skillBitmask) external {
        if (workers[msg.sender].registered) revert AlreadyRegistered();

        workers[msg.sender] = Worker({
            nameHash: nameHash,
            skillBitmask: skillBitmask,
            registered: true
        });

        emit WorkerRegistered(msg.sender, nameHash, skillBitmask);
    }

    /// @notice Update the caller's skill bitmask.
    /// @param skillBitmask New bitmask of skills.
    function updateSkills(uint64 skillBitmask) external {
        if (!workers[msg.sender].registered) revert NotRegistered();

        workers[msg.sender].skillBitmask = skillBitmask;
    }

    /// @notice Check whether an address is a registered worker.
    /// @param worker The address to query.
    /// @return True if the address has registered.
    function isRegistered(address worker) external view returns (bool) {
        return workers[worker].registered;
    }
}
