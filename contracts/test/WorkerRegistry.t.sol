// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/WorkerRegistry.sol";

contract WorkerRegistryTest is Test {
    WorkerRegistry public registry;

    function setUp() public {
        registry = new WorkerRegistry();
    }

    // Feature: gig-platform, Property 1: Worker Registration Round-Trip
    // Validates: Requirements 1.1, 1.2, 1.6
    function testFuzz_workerRegistrationRoundTrip(
        address addr,
        bytes32 nameHash,
        uint64 skillBitmask
    ) public {
        vm.assume(addr != address(0));

        vm.prank(addr);
        registry.registerWorker(nameHash, skillBitmask);

        (bytes32 storedNameHash, uint64 storedSkillBitmask, bool storedRegistered) = registry.workers(addr);

        assertEq(storedRegistered, true);
        assertEq(storedNameHash, nameHash);
        assertEq(storedSkillBitmask, skillBitmask);
        assertEq(registry.isRegistered(addr), true);
    }

    // Feature: gig-platform, Property 2: Double Registration Reverts
    // Validates: Requirements 1.3
    function testFuzz_doubleRegistrationReverts(
        bytes32 nameHash,
        uint64 skillBitmask
    ) public {
        vm.prank(address(1));
        registry.registerWorker(nameHash, skillBitmask);

        vm.prank(address(1));
        vm.expectRevert(WorkerRegistry.AlreadyRegistered.selector);
        registry.registerWorker(nameHash, skillBitmask);
    }

    // Feature: gig-platform, Property 3: updateSkills Round-Trip
    // Validates: Requirements 1.4
    function testFuzz_updateSkillsRoundTrip(uint64 newSkills) public {
        vm.prank(address(1));
        registry.registerWorker(bytes32(0), 0);

        vm.prank(address(1));
        registry.updateSkills(newSkills);

        (, uint64 storedSkillBitmask,) = registry.workers(address(1));
        assertEq(storedSkillBitmask, newSkills);
    }

    // Feature: gig-platform, Property 4: updateSkills Without Registration Reverts
    // Validates: Requirements 1.5
    function testFuzz_updateSkillsUnregisteredReverts(
        address addr,
        uint64 skills
    ) public {
        vm.assume(addr != address(0));
        vm.assume(!registry.isRegistered(addr));

        vm.prank(addr);
        vm.expectRevert(WorkerRegistry.NotRegistered.selector);
        registry.updateSkills(skills);
    }
}
