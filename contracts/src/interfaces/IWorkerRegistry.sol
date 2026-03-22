// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWorkerRegistry {
    function isRegistered(address worker) external view returns (bool);
}
