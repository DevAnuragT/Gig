/**
 * Contract event listeners and historical event fetchers.
 *
 * Uses viem's watchContractEvent for real-time subscriptions
 * and getContractEvents for historical data.
 */

import {
  createPublicClient,
  http,
  type Address,
  type Log,
  type PublicClient,
  type WatchContractEventReturnType,
} from 'viem'
import { monadTestnet } from './wagmi'
import { TASK_ESCROW, WORKER_REGISTRY } from './contracts'

// --- Types ---

export interface TaskCreatedEvent {
  taskId: bigint
  poster: Address
  cid: string
  budget: bigint
  deadline: bigint
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface BidSubmittedEvent {
  taskId: bigint
  worker: Address
  proposalCid: string
  proposedPrice: bigint
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface WorkerAssignedEvent {
  taskId: bigint
  worker: Address
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface DeliverableSubmittedEvent {
  taskId: bigint
  deliverableCid: string
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface PaymentReleasedEvent {
  taskId: bigint
  worker: Address
  amount: bigint
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface TaskCancelledEvent {
  taskId: bigint
  refundedTo: Address
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface AdminOverrideEvent {
  taskId: bigint
  reason: string
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface WorkerRegisteredEvent {
  worker: Address
  nameHash: `0x${string}`
  skillBitmask: bigint
  blockNumber: bigint
  transactionHash: `0x${string}`
}

// --- Client Singleton ---

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

// --- Event Watchers (Real-time Subscriptions) ---

/**
 * Watch for new TaskCreated events in real time.
 * Returns an unwatch function to stop the subscription.
 */
export function watchTaskCreated(
  onEvent: (event: TaskCreatedEvent) => void
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...TASK_ESCROW,
    eventName: 'TaskCreated',
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            taskId: args.taskId,
            poster: args.poster,
            cid: args.cid,
            budget: args.budget,
            deadline: args.deadline,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

/**
 * Watch for BidSubmitted events, optionally filtered by taskId.
 */
export function watchBidSubmitted(
  onEvent: (event: BidSubmittedEvent) => void,
  taskId?: bigint
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...TASK_ESCROW,
    eventName: 'BidSubmitted',
    args: taskId !== undefined ? { taskId } : undefined,
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            taskId: args.taskId,
            worker: args.worker,
            proposalCid: args.proposalCid,
            proposedPrice: args.proposedPrice,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

/**
 * Watch for WorkerAssigned events, optionally filtered by taskId.
 */
export function watchWorkerAssigned(
  onEvent: (event: WorkerAssignedEvent) => void,
  taskId?: bigint
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...TASK_ESCROW,
    eventName: 'WorkerAssigned',
    args: taskId !== undefined ? { taskId } : undefined,
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            taskId: args.taskId,
            worker: args.worker,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

/**
 * Watch for DeliverableSubmitted events, optionally filtered by taskId.
 */
export function watchDeliverableSubmitted(
  onEvent: (event: DeliverableSubmittedEvent) => void,
  taskId?: bigint
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...TASK_ESCROW,
    eventName: 'DeliverableSubmitted',
    args: taskId !== undefined ? { taskId } : undefined,
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            taskId: args.taskId,
            deliverableCid: args.deliverableCid,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

/**
 * Watch for PaymentReleased events.
 */
export function watchPaymentReleased(
  onEvent: (event: PaymentReleasedEvent) => void
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...TASK_ESCROW,
    eventName: 'PaymentReleased',
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            taskId: args.taskId,
            worker: args.worker,
            amount: args.amount,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

/**
 * Watch for TaskCancelled events.
 */
export function watchTaskCancelled(
  onEvent: (event: TaskCancelledEvent) => void
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...TASK_ESCROW,
    eventName: 'TaskCancelled',
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            taskId: args.taskId,
            refundedTo: args.refundedTo,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

/**
 * Watch for WorkerRegistered events on WorkerRegistry.
 */
export function watchWorkerRegistered(
  onEvent: (event: WorkerRegisteredEvent) => void
): WatchContractEventReturnType {
  const client = getClient()

  return client.watchContractEvent({
    ...WORKER_REGISTRY,
    eventName: 'WorkerRegistered',
    onLogs: (logs: Log[]) => {
      for (const log of logs) {
        const args = (log as any).args
        if (args) {
          onEvent({
            worker: args.worker,
            nameHash: args.nameHash,
            skillBitmask: args.skillBitmask,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
          })
        }
      }
    },
  })
}

// --- Historical Event Fetchers ---

/**
 * Fetch all TaskCreated events from a given block number (defaults to earliest).
 */
export async function getTaskCreatedEvents(
  fromBlock: bigint = 0n
): Promise<TaskCreatedEvent[]> {
  const client = getClient()

  const logs = await client.getContractEvents({
    ...TASK_ESCROW,
    eventName: 'TaskCreated',
    fromBlock,
  })

  return logs.map((log: any) => ({
    taskId: log.args.taskId,
    poster: log.args.poster,
    cid: log.args.cid,
    budget: log.args.budget,
    deadline: log.args.deadline,
    blockNumber: log.blockNumber ?? 0n,
    transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
  }))
}

/**
 * Fetch all BidSubmitted events for a specific task.
 */
export async function getBidSubmittedEvents(
  taskId: bigint,
  fromBlock: bigint = 0n
): Promise<BidSubmittedEvent[]> {
  const client = getClient()

  const logs = await client.getContractEvents({
    ...TASK_ESCROW,
    eventName: 'BidSubmitted',
    args: { taskId },
    fromBlock,
  })

  return logs.map((log: any) => ({
    taskId: log.args.taskId,
    worker: log.args.worker,
    proposalCid: log.args.proposalCid,
    proposedPrice: log.args.proposedPrice,
    blockNumber: log.blockNumber ?? 0n,
    transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
  }))
}

/**
 * Fetch the full event history for a specific task across all event types.
 * Returns events sorted by block number.
 */
export async function getTaskHistory(
  taskId: bigint,
  fromBlock: bigint = 0n
): Promise<
  Array<{
    type: string
    blockNumber: bigint
    transactionHash: `0x${string}`
    data: Record<string, unknown>
  }>
> {
  const client = getClient()

  // Fetch all relevant event types in parallel
  const [bids, assigns, deliverables, payments, cancellations, overrides] =
    await Promise.all([
      client.getContractEvents({
        ...TASK_ESCROW,
        eventName: 'BidSubmitted',
        args: { taskId },
        fromBlock,
      }),
      client.getContractEvents({
        ...TASK_ESCROW,
        eventName: 'WorkerAssigned',
        args: { taskId },
        fromBlock,
      }),
      client.getContractEvents({
        ...TASK_ESCROW,
        eventName: 'DeliverableSubmitted',
        args: { taskId },
        fromBlock,
      }),
      client.getContractEvents({
        ...TASK_ESCROW,
        eventName: 'PaymentReleased',
        args: { taskId },
        fromBlock,
      }),
      client.getContractEvents({
        ...TASK_ESCROW,
        eventName: 'TaskCancelled',
        args: { taskId },
        fromBlock,
      }),
      client.getContractEvents({
        ...TASK_ESCROW,
        eventName: 'AdminOverride',
        args: { taskId },
        fromBlock,
      }),
    ])

  const timeline: Array<{
    type: string
    blockNumber: bigint
    transactionHash: `0x${string}`
    data: Record<string, unknown>
  }> = []

  for (const log of bids) {
    timeline.push({
      type: 'BidSubmitted',
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
      data: { ...(log as any).args },
    })
  }

  for (const log of assigns) {
    timeline.push({
      type: 'WorkerAssigned',
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
      data: { ...(log as any).args },
    })
  }

  for (const log of deliverables) {
    timeline.push({
      type: 'DeliverableSubmitted',
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
      data: { ...(log as any).args },
    })
  }

  for (const log of payments) {
    timeline.push({
      type: 'PaymentReleased',
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
      data: { ...(log as any).args },
    })
  }

  for (const log of cancellations) {
    timeline.push({
      type: 'TaskCancelled',
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
      data: { ...(log as any).args },
    })
  }

  for (const log of overrides) {
    timeline.push({
      type: 'AdminOverride',
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ('0x' as `0x${string}`),
      data: { ...(log as any).args },
    })
  }

  // Sort by block number ascending
  timeline.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0))

  return timeline
}
