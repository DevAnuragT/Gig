// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITaskEscrow {
    // --- Enums ---
    enum TaskState { OPEN, ASSIGNED, REVIEW, CLOSED, CANCELLED }

    // --- Events ---
    event TaskCreated(uint256 indexed taskId, address indexed poster, string cid, uint256 budget, uint64 deadline);
    event BidSubmitted(uint256 indexed taskId, address indexed worker, string proposalCid, uint256 proposedPrice);
    event WorkerAssigned(uint256 indexed taskId, address indexed worker);
    event DeliverableSubmitted(uint256 indexed taskId, string deliverableCid);
    event PaymentReleased(uint256 indexed taskId, address indexed worker, uint256 amount);
    event TaskCancelled(uint256 indexed taskId, address indexed refundedTo);
    event AdminOverride(uint256 indexed taskId, string reason);
    event NewAdminProposed(address indexed newAdmin);

    // --- Poster actions ---
    function createTask(string calldata metadataCid, uint64 deadline) external payable returns (uint256 taskId);
    function assignWorker(uint256 taskId, address worker) external;
    function approveAndRelease(uint256 taskId) external;
    function cancelTask(uint256 taskId) external;
    function reclaimAfterTimeout(uint256 taskId) external;

    // --- Worker actions ---
    function submitBid(uint256 taskId, string calldata proposalCid, uint256 proposedPrice) external;
    function submitDeliverable(uint256 taskId, string calldata deliverableCid) external;
    function claimAfterReviewTimeout(uint256 taskId) external;

    // --- Shared ---
    function withdraw() external;

    // --- Admin ---
    function adminCancel(uint256 taskId, string calldata reason) external;
    function proposeAdmin(address newAdmin) external;
    function acceptAdmin() external;
}
