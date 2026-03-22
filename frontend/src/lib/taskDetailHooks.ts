'use client'

import React, { useState, useMemo } from 'react'
import { useReadContract, useWatchContractEvent } from 'wagmi'
import { TASK_ESCROW, WORKER_REGISTRY } from '@/lib/contracts'
import { useAccount } from 'wagmi'
import { fetchFromIPFS } from '@/lib/ipfs'

export interface TaskDetail {
  poster: string
  worker: string
  metadataCid: string
  deliverableCid: string
  budget: bigint
  deadline: number
  reviewDeadline: number
  state: number // 0=OPEN, 1=ASSIGNED, 2=REVIEW, 3=CLOSED, 4=CANCELLED
}

export interface Bid {
  worker: string
  proposalCid: string
  proposedPrice: bigint
  timestamp: number
}

/**
 * Hook to read task data from contract
 */
export function useTaskDetail(taskId: number) {
  const { data: task, isLoading, error } = useReadContract({
    ...TASK_ESCROW,
    functionName: 'tasks',
    args: [BigInt(taskId)],
    query: { enabled: taskId >= 0 },
  })

  return {
    task: task as TaskDetail | undefined,
    isLoading,
    error,
  }
}

/**
 * Hook to index bids for a task from BidSubmitted events
 */
export function useTaskBids(taskId: number) {
  const [bids, setBids] = useState<Bid[]>([])

  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'BidSubmitted',
    onLogs: (logs: any[]) => {
      logs.forEach((log: any) => {
        if (Number(log.args.taskId) === taskId) {
          const bid: Bid = {
            worker: log.args.worker,
            proposalCid: log.args.proposalCid,
            proposedPrice: log.args.proposedPrice,
            timestamp: Date.now(),
          }
          setBids((prev) =>
            prev.find((b) => b.worker === bid.worker)
              ? prev
              : [...prev, bid]
          )
        }
      })
    },
  })

  return bids
}

/**
 * Hook to check if user is a registered worker
 */
export function useIsWorkerRegistered(address?: string) {
  const { data: isRegistered } = useReadContract({
    ...WORKER_REGISTRY,
    functionName: 'isRegistered',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  })

  return Boolean(isRegistered)
}

/**
 * Hook to fetch task metadata from IPFS
 */
export function useTaskMetadata(cid: string | undefined) {
  const [metadata, setMetadata] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    if (!cid) return

    setLoading(true)
    fetchFromIPFS(cid)
      .then(setMetadata)
      .catch((err) => console.error('Failed to fetch task metadata:', err))
      .finally(() => setLoading(false))
  }, [cid])

  return { metadata, loading }
}
