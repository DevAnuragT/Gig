/**
 * High-level contract service layer.
 *
 * Combines contract reads, event fetching, and IPFS metadata
 * into convenient aggregated queries for the frontend.
 */

import type { Address } from 'viem'
import {
  getTask,
  getNextTaskId,
  getPendingWithdrawal,
  isWorkerRegistered,
  getWorker,
  type TaskData,
  type WorkerData,
  TaskState,
  taskStateLabel,
} from './contractReads'
import {
  getTaskCreatedEvents,
  getBidSubmittedEvents,
  getTaskHistory,
  type TaskCreatedEvent,
  type BidSubmittedEvent,
} from './contractEvents'
import { fetchFromIPFS } from './ipfs'

// --- Types ---

export interface TaskMetadata {
  version: string
  title: string
  description: string
  skills: number[]
  attachments?: string[]
  posterProfile?: string
}

export interface BidProposal {
  version: string
  proposal: string
  deliveryDays: number
  workerProfile?: string
}

export interface DeliverableData {
  version: string
  summary: string
  files: string[]
  notes: string
}

export interface TaskWithMetadata {
  id: bigint
  task: TaskData
  metadata: TaskMetadata | null
  stateLabel: string
}

export interface BidWithProposal {
  taskId: bigint
  worker: Address
  proposedPrice: bigint
  proposal: BidProposal | null
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface TaskTimelineEntry {
  type: string
  blockNumber: bigint
  transactionHash: `0x${string}`
  data: Record<string, unknown>
  timestamp?: number
}

export interface DashboardData {
  posterTasks: TaskWithMetadata[]
  workerBids: BidWithProposal[]
  pendingWithdrawal: bigint
  isRegistered: boolean
  worker: WorkerData | null
}

// --- Service Functions ---

/**
 * Get a task along with its IPFS metadata.
 * Returns null metadata if IPFS fetch fails (graceful degradation).
 */
export async function getTaskWithMetadata(taskId: bigint): Promise<TaskWithMetadata> {
  const task = await getTask(taskId)

  let metadata: TaskMetadata | null = null
  if (task.metadataCid) {
    try {
      metadata = await fetchFromIPFS<TaskMetadata>(task.metadataCid)
    } catch (err) {
      console.warn(`Failed to fetch metadata for task ${taskId}:`, err)
    }
  }

  return {
    id: taskId,
    task,
    metadata,
    stateLabel: taskStateLabel(task.state),
  }
}

/**
 * Get all tasks created by a specific poster address.
 * Fetches task data from contract + metadata from IPFS.
 */
export async function getTasksForPoster(
  posterAddress: Address
): Promise<TaskWithMetadata[]> {
  const events = await getTaskCreatedEvents()
  const posterEvents = events.filter(
    (e) => e.poster.toLowerCase() === posterAddress.toLowerCase()
  )

  const tasks = await Promise.all(
    posterEvents.map(async (event) => {
      try {
        return await getTaskWithMetadata(event.taskId)
      } catch {
        return null
      }
    })
  )

  return tasks.filter((t): t is TaskWithMetadata => t !== null)
}

/**
 * Get all bids submitted by a specific worker address.
 * Scans BidSubmitted events across all tasks.
 */
export async function getBidsForWorker(
  workerAddress: Address
): Promise<BidWithProposal[]> {
  // Get all tasks to scan for bids
  const totalTasks = await getNextTaskId()
  const allBids: BidWithProposal[] = []

  const fetchPromises: Promise<void>[] = []

  for (let i = 0n; i < totalTasks; i++) {
    const taskId = i
    fetchPromises.push(
      getBidSubmittedEvents(taskId).then(async (events) => {
        for (const event of events) {
          if (event.worker.toLowerCase() === workerAddress.toLowerCase()) {
            let proposal: BidProposal | null = null
            if (event.proposalCid) {
              try {
                proposal = await fetchFromIPFS<BidProposal>(event.proposalCid)
              } catch {
                // graceful degradation
              }
            }
            allBids.push({
              taskId: event.taskId,
              worker: event.worker,
              proposedPrice: event.proposedPrice,
              proposal,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
            })
          }
        }
      })
    )
  }

  await Promise.all(fetchPromises)

  // Sort by block number descending (most recent first)
  allBids.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0))

  return allBids
}

/**
 * Build a complete timeline of events for a specific task.
 */
export async function getTaskTimeline(
  taskId: bigint
): Promise<TaskTimelineEntry[]> {
  const history = await getTaskHistory(taskId)

  return history.map((entry) => ({
    type: entry.type,
    blockNumber: entry.blockNumber,
    transactionHash: entry.transactionHash,
    data: entry.data,
  }))
}

/**
 * Get aggregated dashboard data for a connected wallet.
 *
 * Includes:
 * - Tasks created by the address (as poster)
 * - Bids submitted by the address (as worker)
 * - Pending withdrawal balance
 * - Worker registration status and data
 */
export async function getDashboardData(address: Address): Promise<DashboardData> {
  const [posterTasks, workerBids, pendingWithdrawal, registered] =
    await Promise.all([
      getTasksForPoster(address),
      getBidsForWorker(address),
      getPendingWithdrawal(address),
      isWorkerRegistered(address),
    ])

  let worker: WorkerData | null = null
  if (registered) {
    try {
      worker = await getWorker(address)
    } catch {
      // ignore
    }
  }

  return {
    posterTasks,
    workerBids,
    pendingWithdrawal,
    isRegistered: registered,
    worker,
  }
}

/**
 * Get the deliverable metadata for a task in REVIEW or CLOSED state.
 * Returns null if the task has no deliverable CID or if fetch fails.
 */
export async function getDeliverable(
  taskId: bigint
): Promise<DeliverableData | null> {
  const task = await getTask(taskId)

  if (!task.deliverableCid) return null

  try {
    return await fetchFromIPFS<DeliverableData>(task.deliverableCid)
  } catch (err) {
    console.warn(`Failed to fetch deliverable for task ${taskId}:`, err)
    return null
  }
}

// --- Skill Helpers ---

export const SKILL_NAMES: Record<number, string> = {
  0: 'Smart Contract Development',
  1: 'Frontend Development',
  2: 'Backend Development',
  3: 'UI/UX Design',
  4: 'Security Audit',
  5: 'Technical Writing',
  6: 'Data Labeling',
  7: 'QA / Testing',
}

/**
 * Decode a skill bitmask into human-readable skill names.
 */
export function decodeSkills(bitmask: bigint | number): string[] {
  const mask = typeof bitmask === 'bigint' ? Number(bitmask) : bitmask
  const skills: string[] = []

  for (let bit = 0; bit < 8; bit++) {
    if (mask & (1 << bit)) {
      skills.push(SKILL_NAMES[bit] ?? `Skill ${bit}`)
    }
  }

  return skills
}

/**
 * Encode an array of skill bit indices into a bitmask.
 */
export function encodeSkills(skillBits: number[]): number {
  let mask = 0
  for (const bit of skillBits) {
    if (bit >= 0 && bit < 64) {
      mask |= 1 << bit
    }
  }
  return mask
}
