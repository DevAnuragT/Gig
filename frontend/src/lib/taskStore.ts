'use client'

import { useState, useEffect } from 'react'
import { useWatchContractEvent } from 'wagmi'
import { TASK_ESCROW } from '@/lib/contracts'

/**
 * Task store — manages indexed tasks from TaskCreated events
 */

export interface IndexedTask {
  taskId: number
  poster: string
  budget: bigint
  deadline: number
  metadataCid: string
}

export function useTaskFeed() {
  const [tasks, setTasks] = useState<IndexedTask[]>([])

  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'TaskCreated',
    onLogs: (logs: any[]) => {
      logs.forEach((log: any) => {
        const task: IndexedTask = {
          taskId: Number(log.args.taskId),
          poster: log.args.poster,
          budget: log.args.budget,
          deadline: Number(log.args.deadline),
          metadataCid: log.args.cid,
        }
        setTasks((prev) => [...prev, task])
      })
    },
  })

  return tasks
}
