// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaskEscrow.sol";
import "../src/WorkerRegistry.sol";

contract ReenteringWorker {
    TaskEscrow public immutable escrow;
    bool public attackInProgress;

    constructor(TaskEscrow _escrow) {
        escrow = _escrow;
    }

    function registerSelf(WorkerRegistry registry) external {
        registry.registerWorker(bytes32("evil"), 0);
    }

    function submitBid(uint256 taskId, string calldata cid, uint256 price) external {
        escrow.submitBid(taskId, cid, price);
    }

    function submitDeliverable(uint256 taskId, string calldata cid) external {
        escrow.submitDeliverable(taskId, cid);
    }

    function attackWithdraw() external {
        attackInProgress = true;
        escrow.withdraw();
        attackInProgress = false;
    }

    receive() external payable {
        if (attackInProgress) {
            (bool ok,) = address(escrow).call(abi.encodeWithSelector(TaskEscrow.withdraw.selector));
            require(ok, "reenter failed");
        }
    }
}

contract TaskEscrowTest is Test {
    TaskEscrow public escrow;
    WorkerRegistry public registry;

    address constant ADMIN  = address(0x1);
    address constant POSTER = address(0x2);
    address constant WORKER = address(0x3);

    function setUp() public {
        registry = new WorkerRegistry();
        escrow   = new TaskEscrow(address(registry), ADMIN);

        vm.prank(WORKER);
        registry.registerWorker(bytes32("worker"), 0);
    }

    function _createTaskWithBudget(uint256 value) internal returns (uint256 taskId) {
        vm.deal(POSTER, value);
        vm.prank(POSTER);
        taskId = escrow.createTask{value: value}("QmTask", uint64(block.timestamp + 1 days));
    }

    function _createTask() internal returns (uint256 taskId) {
        return _createTaskWithBudget(0.5 ether);
    }

    function _createAssignedTask() internal returns (uint256 taskId) {
        taskId = _createTask();

        vm.prank(WORKER);
        escrow.submitBid(taskId, "QmProposal", 0.1 ether);

        vm.prank(POSTER);
        escrow.assignWorker(taskId, WORKER);
    }

    function _createReviewTask() internal returns (uint256 taskId) {
        taskId = _createAssignedTask();

        vm.prank(WORKER);
        escrow.submitDeliverable(taskId, "QmDeliverable");
    }

    function testFuzz_createTaskRoundTrip(string memory cid, uint64 deadline, uint256 value) public {
        value = bound(value, 1, 1 ether);
        deadline = uint64(bound(uint256(deadline), block.timestamp + 1, type(uint64).max));

        vm.deal(POSTER, value);
        uint256 expectedTaskId = escrow.nextTaskId();

        vm.prank(POSTER);
        uint256 taskId = escrow.createTask{value: value}(cid, deadline);

        assertEq(taskId, expectedTaskId);

        (
            address poster,
            address worker,
            string memory metadataCid,
            ,
            uint256 budget,
            uint64 storedDeadline,
            ,
            TaskEscrow.TaskState state
        ) = escrow.tasks(taskId);

        assertEq(poster, POSTER);
        assertEq(worker, address(0));
        assertEq(metadataCid, cid);
        assertEq(budget, value);
        assertEq(storedDeadline, deadline);
        assertEq(uint8(state), uint8(TaskEscrow.TaskState.OPEN));
    }

    function testFuzz_taskValueCapEnforced(uint256 value) public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        vm.deal(POSTER, value > 0 ? value : 1);

        if (value > 1 ether) {
            vm.prank(POSTER);
            vm.expectRevert(TaskEscrow.ExceedsMaxValue.selector);
            escrow.createTask{value: value}("QmTask", deadline);
            return;
        }

        if (value == 0) {
            vm.prank(POSTER);
            vm.expectRevert(TaskEscrow.ZeroBudget.selector);
            escrow.createTask{value: 0}("QmTask", deadline);
            return;
        }

        vm.prank(POSTER);
        uint256 taskId = escrow.createTask{value: value}("QmTask", deadline);
        (, , , , uint256 budget, , , ) = escrow.tasks(taskId);
        assertEq(budget, value);
    }

    function testFuzz_deadlineValidation(uint64 deadline) public {
        vm.deal(POSTER, 0.1 ether);

        if (deadline <= block.timestamp) {
            vm.prank(POSTER);
            vm.expectRevert(TaskEscrow.InvalidDeadline.selector);
            escrow.createTask{value: 0.1 ether}("QmTask", deadline);
            return;
        }

        vm.prank(POSTER);
        uint256 taskId = escrow.createTask{value: 0.1 ether}("QmTask", deadline);
        (, , , , , uint64 storedDeadline, , ) = escrow.tasks(taskId);
        assertEq(storedDeadline, deadline);
    }

    function testFuzz_submitBidRegistrationGate(address unregistered) public {
        vm.assume(unregistered != address(0));
        vm.assume(unregistered != WORKER);

        uint256 taskId = _createTask();

        vm.prank(unregistered);
        vm.expectRevert(TaskEscrow.NotRegistered.selector);
        escrow.submitBid(taskId, "QmProposal", 0.1 ether);
    }

    function testFuzz_bidRoundTrip(string memory cid, uint256 price) public {
        price = bound(price, 0, 0.5 ether);
        uint256 taskId = _createTask();

        vm.prank(WORKER);
        escrow.submitBid(taskId, cid, price);

        (string memory storedCid, uint256 storedPrice, bool exists) = escrow.bids(taskId, WORKER);
        assertTrue(exists);
        assertEq(storedCid, cid);
        assertEq(storedPrice, price);

        vm.prank(WORKER);
        vm.expectRevert(TaskEscrow.BidAlreadyExists.selector);
        escrow.submitBid(taskId, cid, price);
    }

    function testFuzz_bidPriceCap(uint256 price) public {
        uint256 taskId = _createTask();

        if (price > 0.5 ether) {
            vm.prank(WORKER);
            vm.expectRevert(TaskEscrow.PriceTooHigh.selector);
            escrow.submitBid(taskId, "QmProposal", price);
            return;
        }

        vm.prank(WORKER);
        escrow.submitBid(taskId, "QmProposal", price);
        (, , bool exists) = escrow.bids(taskId, WORKER);
        assertTrue(exists);
    }

    function testFuzz_assignWorkerRequiresBid(address worker) public {
        vm.assume(worker != address(0));
        vm.assume(worker != WORKER);

        uint256 taskId = _createTask();

        vm.prank(POSTER);
        vm.expectRevert(TaskEscrow.BidNotFound.selector);
        escrow.assignWorker(taskId, worker);
    }

    function testFuzz_cancelTaskRefundsPoster(uint256 value) public {
        value = bound(value, 1, 1 ether);
        uint256 taskId = _createTaskWithBudget(value);

        uint256 pendingBefore = escrow.pendingWithdrawals(POSTER);

        vm.prank(POSTER);
        escrow.cancelTask(taskId);

        (, , , , , , , TaskEscrow.TaskState state) = escrow.tasks(taskId);
        assertEq(uint8(state), uint8(TaskEscrow.TaskState.CANCELLED));
        assertEq(escrow.pendingWithdrawals(POSTER), pendingBefore + value);
    }

    function testFuzz_submitDeliverableSetsReviewDeadline(string memory cid) public {
        uint256 taskId = _createAssignedTask();
        uint256 tsBefore = block.timestamp;

        vm.prank(WORKER);
        escrow.submitDeliverable(taskId, cid);

        (
            ,
            ,
            ,
            string memory deliverableCid,
            ,
            ,
            uint64 reviewDeadline,
            TaskEscrow.TaskState state
        ) = escrow.tasks(taskId);

        assertEq(uint8(state), uint8(TaskEscrow.TaskState.REVIEW));
        assertEq(deliverableCid, cid);
        assertEq(reviewDeadline, tsBefore + escrow.REVIEW_WINDOW());
    }

    function testFuzz_approveAndReleaseCreditsWorker(uint256 value) public {
        value = bound(value, 1, 1 ether);

        uint256 taskId = _createTaskWithBudget(value);

        vm.prank(WORKER);
        escrow.submitBid(taskId, "QmProposal", 0);

        vm.prank(POSTER);
        escrow.assignWorker(taskId, WORKER);

        vm.prank(WORKER);
        escrow.submitDeliverable(taskId, "QmDeliverable");

        uint256 pendingBefore = escrow.pendingWithdrawals(WORKER);

        vm.prank(POSTER);
        escrow.approveAndRelease(taskId);

        (, , , , , , , TaskEscrow.TaskState state) = escrow.tasks(taskId);
        assertEq(uint8(state), uint8(TaskEscrow.TaskState.CLOSED));
        assertEq(escrow.pendingWithdrawals(WORKER), pendingBefore + value);
    }

    function testFuzz_withdrawRoundTrip(uint256 value) public {
        value = bound(value, 1, 1 ether);

        uint256 taskId = _createTaskWithBudget(value);

        vm.prank(WORKER);
        escrow.submitBid(taskId, "QmProposal", 0);

        vm.prank(POSTER);
        escrow.assignWorker(taskId, WORKER);

        vm.prank(WORKER);
        escrow.submitDeliverable(taskId, "QmDeliverable");

        vm.prank(POSTER);
        escrow.approveAndRelease(taskId);

        uint256 balanceBefore = WORKER.balance;

        vm.prank(WORKER);
        escrow.withdraw();

        assertEq(WORKER.balance, balanceBefore + value);
        assertEq(escrow.pendingWithdrawals(WORKER), 0);
    }

    function test_reclaimAfterTimeoutDeadlineEnforcement() public {
        uint256 taskId = _createAssignedTask();

        vm.prank(POSTER);
        vm.expectRevert(TaskEscrow.DeadlineNotPassed.selector);
        escrow.reclaimAfterTimeout(taskId);

        vm.warp(block.timestamp + 2 days);

        uint256 pendingBefore = escrow.pendingWithdrawals(POSTER);
        vm.prank(POSTER);
        escrow.reclaimAfterTimeout(taskId);

        (, , , , uint256 budget, , , TaskEscrow.TaskState state) = escrow.tasks(taskId);
        assertEq(uint8(state), uint8(TaskEscrow.TaskState.CANCELLED));
        assertEq(escrow.pendingWithdrawals(POSTER), pendingBefore + budget);
    }

    function test_claimAfterReviewTimeoutEnforcement() public {
        uint256 taskId = _createReviewTask();

        vm.prank(WORKER);
        vm.expectRevert(TaskEscrow.ReviewWindowNotPassed.selector);
        escrow.claimAfterReviewTimeout(taskId);

        vm.warp(block.timestamp + escrow.REVIEW_WINDOW() + 1);

        uint256 pendingBefore = escrow.pendingWithdrawals(WORKER);
        vm.prank(WORKER);
        escrow.claimAfterReviewTimeout(taskId);

        (, , , , uint256 budget, , , TaskEscrow.TaskState state) = escrow.tasks(taskId);
        assertEq(uint8(state), uint8(TaskEscrow.TaskState.CLOSED));
        assertEq(escrow.pendingWithdrawals(WORKER), pendingBefore + budget);
    }

    function testFuzz_adminTwoStepTransfer(address newAdmin) public {
        vm.assume(newAdmin != address(0));
        vm.assume(newAdmin != ADMIN);

        vm.prank(ADMIN);
        escrow.proposeAdmin(newAdmin);

        assertEq(escrow.pendingAdmin(), newAdmin);

        vm.prank(newAdmin);
        escrow.acceptAdmin();

        assertEq(escrow.admin(), newAdmin);
        assertEq(escrow.pendingAdmin(), address(0));
    }

    function test_adminCancelCreditsPoster() public {
        uint256 taskId = _createTask();
        uint256 pendingBefore = escrow.pendingWithdrawals(POSTER);

        vm.prank(ADMIN);
        escrow.adminCancel(taskId, "abuse");

        (, , , , uint256 budget, , , TaskEscrow.TaskState state) = escrow.tasks(taskId);
        assertEq(uint8(state), uint8(TaskEscrow.TaskState.CANCELLED));
        assertEq(escrow.pendingWithdrawals(POSTER), pendingBefore + budget);
    }

    function testFuzz_nonAdminCancelReverts(address caller) public {
        vm.assume(caller != ADMIN);

        uint256 taskId = _createTask();

        vm.prank(caller);
        vm.expectRevert(TaskEscrow.Unauthorized.selector);
        escrow.adminCancel(taskId, "abuse");
    }

    function test_reentrancyBlockedOnWithdraw() public {
        ReenteringWorker attacker = new ReenteringWorker(escrow);
        attacker.registerSelf(registry);

        uint256 taskId = _createTaskWithBudget(0.3 ether);

        attacker.submitBid(taskId, "QmEvilBid", 0);

        vm.prank(POSTER);
        escrow.assignWorker(taskId, address(attacker));

        attacker.submitDeliverable(taskId, "QmEvilDeliverable");

        vm.prank(POSTER);
        escrow.approveAndRelease(taskId);

        uint256 pendingBefore = escrow.pendingWithdrawals(address(attacker));
        vm.expectRevert();
        attacker.attackWithdraw();

        // Entire withdraw tx reverts, so pending amount remains intact.
        assertEq(escrow.pendingWithdrawals(address(attacker)), pendingBefore);
    }
}
