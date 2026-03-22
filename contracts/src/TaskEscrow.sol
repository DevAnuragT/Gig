// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./utils/ReentrancyGuard.sol";
import "./interfaces/IWorkerRegistry.sol";

/**
 * @title TaskEscrow
 * @notice Manages the full poster-worker task lifecycle with escrowed funds.
 *         All ETH payouts use a pull-payment ledger (pendingWithdrawals).
 */
contract TaskEscrow is ReentrancyGuard {

    // -------------------------------------------------------------------------
    // State machine
    // -------------------------------------------------------------------------

    enum TaskState { OPEN, ASSIGNED, REVIEW, CLOSED, CANCELLED }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Task {
        address   poster;
        address   worker;           // zero until assigned
        string    metadataCid;
        string    deliverableCid;   // set on submitDeliverable
        uint256   budget;
        uint64    deadline;
        uint64    reviewDeadline;   // set when entering REVIEW
        TaskState state;
    }

    struct Bid {
        string  proposalCid;
        uint256 proposedPrice;
        bool    exists;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    mapping(uint256 => Task)                        public tasks;
    mapping(uint256 => mapping(address => Bid))     public bids;
    mapping(address => uint256)                     public pendingWithdrawals;
    uint256 public nextTaskId;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant MAX_TASK_VALUE = 1 ether;
    uint64  public constant REVIEW_WINDOW  = 7 days;

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    address public admin;
    address public pendingAdmin;
    IWorkerRegistry public immutable registry;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TaskCreated(uint256 indexed taskId, address indexed poster, string cid, uint256 budget, uint64 deadline);
    event BidSubmitted(uint256 indexed taskId, address indexed worker, string proposalCid, uint256 proposedPrice);
    event WorkerAssigned(uint256 indexed taskId, address indexed worker);
    event DeliverableSubmitted(uint256 indexed taskId, string deliverableCid);
    event PaymentReleased(uint256 indexed taskId, address indexed worker, uint256 amount);
    event TaskCancelled(uint256 indexed taskId, address indexed refundedTo);
    event AdminOverride(uint256 indexed taskId, string reason);
    event NewAdminProposed(address indexed newAdmin);

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    error ZeroBudget();
    error ExceedsMaxValue();
    error InvalidDeadline();
    error NotRegistered();
    error InvalidState();
    error PriceTooHigh();
    error BidAlreadyExists();
    error Unauthorized();
    error BidNotFound();
    error DeadlineNotPassed();
    error ReviewWindowNotPassed();
    error NothingToWithdraw();
    error InvalidAdminAddress();
    error NotPendingAdmin();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _registry, address _admin) {
        registry = IWorkerRegistry(_registry);
        admin    = _admin;
    }

    // -------------------------------------------------------------------------
    // Poster actions
    // -------------------------------------------------------------------------

    /**
     * @notice Create a new task with escrowed funds.
     * @param metadataCid IPFS CID of the task metadata JSON.
     * @param deadline    Unix timestamp after which the task is considered overdue.
     * @return taskId     Monotonically incrementing task identifier.
     */
    function createTask(string calldata metadataCid, uint64 deadline)
        external
        payable
        returns (uint256 taskId)
    {
        if (msg.value == 0)              revert ZeroBudget();
        if (msg.value > MAX_TASK_VALUE)  revert ExceedsMaxValue();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        taskId = nextTaskId;
        nextTaskId++;

        tasks[taskId] = Task({
            poster:         msg.sender,
            worker:         address(0),
            metadataCid:    metadataCid,
            deliverableCid: "",
            budget:         msg.value,
            deadline:       deadline,
            reviewDeadline: 0,
            state:          TaskState.OPEN
        });

        emit TaskCreated(taskId, msg.sender, metadataCid, msg.value, deadline);
    }

    function assignWorker(uint256 taskId, address worker) external {
        if (msg.sender != tasks[taskId].poster)       revert Unauthorized();
        if (tasks[taskId].state != TaskState.OPEN)    revert InvalidState();
        if (!bids[taskId][worker].exists)             revert BidNotFound();

        tasks[taskId].state  = TaskState.ASSIGNED;
        tasks[taskId].worker = worker;

        emit WorkerAssigned(taskId, worker);
    }

    function approveAndRelease(uint256 taskId) external {
        if (msg.sender != tasks[taskId].poster)       revert Unauthorized();
        if (tasks[taskId].state != TaskState.REVIEW)  revert InvalidState();

        tasks[taskId].state = TaskState.CLOSED;
        pendingWithdrawals[tasks[taskId].worker] += tasks[taskId].budget;

        emit PaymentReleased(taskId, tasks[taskId].worker, tasks[taskId].budget);
    }

    function cancelTask(uint256 taskId) external {
        if (msg.sender != tasks[taskId].poster)      revert Unauthorized();
        if (tasks[taskId].state != TaskState.OPEN)   revert InvalidState();

        tasks[taskId].state = TaskState.CANCELLED;
        pendingWithdrawals[tasks[taskId].poster] += tasks[taskId].budget;

        emit TaskCancelled(taskId, tasks[taskId].poster);
    }

    function reclaimAfterTimeout(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];

        if (msg.sender != task.poster)            revert Unauthorized();
        if (task.state != TaskState.ASSIGNED)     revert InvalidState();
        if (block.timestamp <= task.deadline)     revert DeadlineNotPassed();

        task.state = TaskState.CANCELLED;
        pendingWithdrawals[task.poster] += task.budget;

        emit TaskCancelled(taskId, task.poster);
    }

    // -------------------------------------------------------------------------
    // Worker actions
    // -------------------------------------------------------------------------

    function submitBid(uint256 taskId, string calldata proposalCid, uint256 proposedPrice) external {
        if (!registry.isRegistered(msg.sender))        revert NotRegistered();
        if (tasks[taskId].state != TaskState.OPEN)     revert InvalidState();
        if (proposedPrice > tasks[taskId].budget)      revert PriceTooHigh();
        if (bids[taskId][msg.sender].exists)           revert BidAlreadyExists();

        bids[taskId][msg.sender] = Bid({
            proposalCid:   proposalCid,
            proposedPrice: proposedPrice,
            exists:        true
        });

        emit BidSubmitted(taskId, msg.sender, proposalCid, proposedPrice);
    }

    function submitDeliverable(uint256 taskId, string calldata deliverableCid) external {
        if (msg.sender != tasks[taskId].worker)           revert Unauthorized();
        if (tasks[taskId].state != TaskState.ASSIGNED)    revert InvalidState();

        tasks[taskId].deliverableCid  = deliverableCid;
        tasks[taskId].reviewDeadline  = uint64(block.timestamp) + REVIEW_WINDOW;
        tasks[taskId].state           = TaskState.REVIEW;

        emit DeliverableSubmitted(taskId, deliverableCid);
    }

    function claimAfterReviewTimeout(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];

        if (msg.sender != task.worker)                revert Unauthorized();
        if (task.state != TaskState.REVIEW)           revert InvalidState();
        if (block.timestamp <= task.reviewDeadline)   revert ReviewWindowNotPassed();

        task.state = TaskState.CLOSED;
        pendingWithdrawals[task.worker] += task.budget;

        emit PaymentReleased(taskId, task.worker, task.budget);
    }

    // -------------------------------------------------------------------------
    // Shared
    // -------------------------------------------------------------------------

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function adminCancel(uint256 taskId, string calldata reason) external {
        if (msg.sender != admin) revert Unauthorized();

        Task storage task = tasks[taskId];
        if (task.state == TaskState.CLOSED || task.state == TaskState.CANCELLED) {
            revert InvalidState();
        }

        task.state = TaskState.CANCELLED;
        pendingWithdrawals[task.poster] += task.budget;

        emit AdminOverride(taskId, reason);
        emit TaskCancelled(taskId, task.poster);
    }

    function proposeAdmin(address newAdmin) external {
        if (msg.sender != admin)      revert Unauthorized();
        if (newAdmin == address(0))   revert InvalidAdminAddress();

        pendingAdmin = newAdmin;
        emit NewAdminProposed(newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();

        admin = pendingAdmin;
        pendingAdmin = address(0);
    }
}
