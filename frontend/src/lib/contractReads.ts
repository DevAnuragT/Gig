/**
 * Contract read functions for querying on-chain data.
 *
 * These are pure read functions that wrap viem's readContract
 * for type-safe access to WorkerRegistry and TaskEscrow state.
 */

import { createPublicClient, http, type Address, type PublicClient } from 'viem'
import { monadTestnet } from './wagmi'
import { TASK_ESCROW, WORKER_REGISTRY } from './contracts'

// --- Types ---

export interface TaskData {
  poster: Address
  worker: Address
  metadataCid: string
  deliverableCid: string
  budget: bigint
  deadline: bigint
  reviewDeadline: bigint
  state: number // TaskState enum: 0=OPEN, 1=ASSIGNED, 2=REVIEW, 3=CLOSED, 4=CANCELLED
}

export interface WorkerData {
  nameHash: `0x${string}`
  skillBitmask: bigint
  registered: boolean
}

export interface BidData {
  proposalCid: string
  proposedPrice: bigint
  exists: boolean
}

export const TaskState = {
  OPEN: 0,
  ASSIGNED: 1,
  REVIEW: 2,
  CLOSED: 3,
  CANCELLED: 4,
} as const

export type TaskStateKey = keyof typeof TaskState

export function taskStateLabel(state: number): TaskStateKey {
  const labels: Record<number, TaskStateKey> = {
    0: 'OPEN',
    1: 'ASSIGNED',
    2: 'REVIEW',
    3: 'CLOSED',
    4: 'CANCELLED',
  }
  return labels[state] ?? 'OPEN'
}

// --- Public Client Singleton ---

let _client: PublicClient | null = null

function getClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    })
  }
  return _client
}

// --- Task Reads ---

/**
 * Read a single task from TaskEscrow by ID.
 */
export async function getTask(taskId: bigint): Promise<TaskData> {
  const client = getClient()

  const result = await client.readContract({
    ...TASK_ESCROW,
    functionName: 'tasks',
    args: [taskId],
  }) as [Address, Address, string, string, bigint, bigint, bigint, number]

  return {
    poster: result[0],
    worker: result[1],
    metadataCid: result[2],
    deliverableCid: result[3],
    budget: result[4],
    deadline: result[5],
    reviewDeadline: result[6],
    state: result[7],
  }
}

/**
 * Get the next task ID (total number of tasks created).
 */
export async function getNextTaskId(): Promise<bigint> {
  const client = getClient()

  return await client.readContract({
    ...TASK_ESCROW,
    functionName: 'nextTaskId',
  }) as bigint
}

/**
 * Read multiple tasks by fetching from 0 to nextTaskId.
 * Optionally filter by state.
 */
export async function getAllTasks(filterState?: number): Promise<(TaskData & { id: bigint })[]> {
  const total = await getNextTaskId()
  const tasks: (TaskData & { id: bigint })[] = []

  const promises: Promise<void>[] = []
  for (let i = 0n; i < total; i++) {
    const taskId = i
    promises.push(
      getTask(taskId).then((task) => {
        if (filterState === undefined || task.state === filterState) {
          tasks.push({ ...task, id: taskId })
        }
      })
    )
  }

  await Promise.all(promises)

  // Sort by ID ascending
  tasks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return tasks
}

/**
 * Get all open tasks.
 */
export async function getOpenTasks(): Promise<(TaskData & { id: bigint })[]> {
  return getAllTasks(TaskState.OPEN)
}

// --- Bid Reads ---

/**
 * Read a bid for a specific task and worker.
 */
export async function getBid(taskId: bigint, workerAddress: Address): Promise<BidData> {
  const client = getClient()

  const result = await client.readContract({
    ...TASK_ESCROW,
    functionName: 'bids',
    args: [taskId, workerAddress],
  }) as [string, bigint, boolean]

  return {
    proposalCid: result[0],
    proposedPrice: result[1],
    exists: result[2],
  }
}

// --- Worker Reads ---

/**
 * Read a worker's registration data from WorkerRegistry.
 */
export async function getWorker(workerAddress: Address): Promise<WorkerData> {
  const client = getClient()

  const result = await client.readContract({
    ...WORKER_REGISTRY,
    functionName: 'workers',
    args: [workerAddress],
  }) as [`0x${string}`, bigint, boolean]

  return {
    nameHash: result[0],
    skillBitmask: result[1],
    registered: result[2],
  }
}

/**
 * Check if an address is a registered worker.
 */
export async function isWorkerRegistered(workerAddress: Address): Promise<boolean> {
  const client = getClient()

  return await client.readContract({
    ...WORKER_REGISTRY,
    functionName: 'isRegistered',
    args: [workerAddress],
  }) as boolean
}

// --- Withdrawal Reads ---

/**
 * Get the pending withdrawal balance for an address.
 */
export async function getPendingWithdrawal(address: Address): Promise<bigint> {
  const client = getClient()

  return await client.readContract({
    ...TASK_ESCROW,
    functionName: 'pendingWithdrawals',
    args: [address],
  }) as bigint
}

// --- Contract Constants ---

/**
 * Read the MAX_TASK_VALUE constant.
 */
export async function getMaxTaskValue(): Promise<bigint> {
  const client = getClient()

  return await client.readContract({
    ...TASK_ESCROW,
    functionName: 'MAX_TASK_VALUE',
  }) as bigint
}

/**
 * Read the REVIEW_WINDOW constant.
 */
export async function getReviewWindow(): Promise<bigint> {
  const client = getClient()

  return await client.readContract({
    ...TASK_ESCROW,
    functionName: 'REVIEW_WINDOW',
  }) as bigint
}

/**
 * Read the current admin address.
 */
export async function getAdmin(): Promise<Address> {
  const client = getClient()

  return await client.readContract({
    ...TASK_ESCROW,
    functionName: 'admin',
  }) as Address
}
