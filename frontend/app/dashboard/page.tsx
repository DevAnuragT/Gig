'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi'
import { TASK_ESCROW } from '@/lib/contracts'
import TaskStateDisplay from '@/components/TaskStateDisplay'

interface PosterTask {
  id: number
  poster: string
  metadataCid: string
  budget: bigint
  deadline: bigint
  state: number
}

interface Bid {
  taskId: number
  worker: string
  proposalCid: string
  proposedPrice: bigint
}

const OPEN = 0
const ASSIGNED = 1
const REVIEW = 2
const CLOSED = 3
const CANCELLED = 4

export default function DashboardPage() {
  const { address: connectedAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'tasks' | 'bids' | 'withdrawals'>('tasks')
  const [tasks, setTasks] = useState<PosterTask[]>([])
  const [bids, setBids] = useState<Bid[]>([])

  const { writeContract: withdraw } = useWriteContract()
  const { writeContract: cancelTask } = useWriteContract()
  const { writeContract: approveAndRelease } = useWriteContract()
  const { writeContract: reclaimAfterTimeout } = useWriteContract()

  // Redirect if not connected
  if (!isConnected) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <p className="text-gray-600">Please connect your wallet to view your dashboard.</p>
          </div>
        </div>
      </main>
    )
  }

  // Fetch pending withdrawals
  const { data: pendingBalance } = useReadContract({
    address: TASK_ESCROW.address as `0x${string}`,
    abi: TASK_ESCROW.abi,
    functionName: 'pendingWithdrawals',
    args: connectedAddress ? [connectedAddress] : undefined,
    query: { enabled: Boolean(connectedAddress) },
  })

  // Keep local task list in sync from chain events.
  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'TaskCreated',
    onLogs: (logs: any[]) => {
      setTasks((prev) => {
        const next = [...prev]
        logs.forEach((log) => {
          const id = Number(log.args?.taskId)
          if (next.some((t) => t.id === id)) return
          next.push({
            id,
            poster: String(log.args?.poster || ''),
            metadataCid: String(log.args?.cid || ''),
            budget: (log.args?.budget as bigint) || BigInt(0),
            deadline: (log.args?.deadline as bigint) || BigInt(0),
            state: OPEN,
          })
        })
        return next.sort((a, b) => b.id - a.id)
      })
    },
  })

  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'WorkerAssigned',
    onLogs: (logs: any[]) => {
      setTasks((prev) =>
        prev.map((task) =>
          logs.some((log) => Number(log.args?.taskId) === task.id)
            ? { ...task, state: ASSIGNED }
            : task
        )
      )
    },
  })

  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'DeliverableSubmitted',
    onLogs: (logs: any[]) => {
      setTasks((prev) =>
        prev.map((task) =>
          logs.some((log) => Number(log.args?.taskId) === task.id)
            ? { ...task, state: REVIEW }
            : task
        )
      )
    },
  })

  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'PaymentReleased',
    onLogs: (logs: any[]) => {
      setTasks((prev) =>
        prev.map((task) =>
          logs.some((log) => Number(log.args?.taskId) === task.id)
            ? { ...task, state: CLOSED }
            : task
        )
      )
    },
  })

  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'TaskCancelled',
    onLogs: (logs: any[]) => {
      setTasks((prev) =>
        prev.map((task) =>
          logs.some((log) => Number(log.args?.taskId) === task.id)
            ? { ...task, state: CANCELLED }
            : task
        )
      )
    },
  })

  // Watch bids submitted by the connected worker.
  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'BidSubmitted',
    onLogs: (logs: any[]) => {
      setBids((prev) => {
        const next = [...prev]
        logs.forEach((log) => {
          const worker = String(log.args?.worker || '')
          if (!connectedAddress || worker.toLowerCase() !== connectedAddress.toLowerCase()) {
            return
          }
          const bid: Bid = {
            taskId: Number(log.args?.taskId || 0),
            worker,
            proposalCid: String(log.args?.proposalCid || ''),
            proposedPrice: (log.args?.proposedPrice as bigint) || BigInt(0),
          }
          const duplicate = next.some(
            (b) => b.taskId === bid.taskId && b.worker.toLowerCase() === bid.worker.toLowerCase()
          )
          if (!duplicate) next.push(bid)
        })
        return next.sort((a, b) => b.taskId - a.taskId)
      })
    },
  })

  const handleWithdraw = async () => {
    if (!connectedAddress) return
    try {
      withdraw({
        ...TASK_ESCROW,
        functionName: 'withdraw',
        args: [],
      })
    } catch (err) {
      console.error('Withdrawal failed:', err)
    }
  }

  const balanceInMON =
    pendingBalance && typeof pendingBalance === 'bigint'
      ? Number(pendingBalance) / 1e18
      : 0

  const myTasks = useMemo(
    () => tasks.filter((task) => task.poster.toLowerCase() === connectedAddress?.toLowerCase()),
    [tasks, connectedAddress]
  )

  const myBids = useMemo(
    () => bids.filter((bid) => bid.worker.toLowerCase() === connectedAddress?.toLowerCase()),
    [bids, connectedAddress]
  )

  const handleCancelTask = (taskId: number) => {
    cancelTask({
      ...TASK_ESCROW,
      functionName: 'cancelTask',
      args: [BigInt(taskId)],
    })
  }

  const handleApproveRelease = (taskId: number) => {
    approveAndRelease({
      ...TASK_ESCROW,
      functionName: 'approveAndRelease',
      args: [BigInt(taskId)],
    })
  }

  const handleReclaim = (taskId: number) => {
    reclaimAfterTimeout({
      ...TASK_ESCROW,
      functionName: 'reclaimAfterTimeout',
      args: [BigInt(taskId)],
    })
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">
            {connectedAddress ? `${connectedAddress.slice(0, 10)}...${connectedAddress.slice(-8)}` : 'User'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'tasks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            My Tasks (Poster)
          </button>
          <button
            onClick={() => setActiveTab('bids')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'bids'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            My Bids (Worker)
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'withdrawals'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Withdrawals
          </button>
        </div>

        {/* Content */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Tasks You Posted</h2>
            {myTasks.length === 0 ? (
              <p className="text-gray-600">No tasks found yet from your wallet activity in this session.</p>
            ) : (
              <div className="grid gap-4">
                {myTasks.map((task) => {
                  const deadlineMs = Number(task.deadline) * 1000
                  const canReclaim = task.state === ASSIGNED && Date.now() > deadlineMs

                  return (
                    <div key={task.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">Task #{task.id}</p>
                          <p className="text-sm text-gray-600">Budget: {(Number(task.budget) / 1e18).toFixed(4)} MON</p>
                          <p className="text-sm text-gray-600">Deadline: {new Date(deadlineMs).toLocaleString()}</p>
                        </div>
                        <TaskStateDisplay state={task.state} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                        >
                          View Details / Assign
                        </Link>

                        {task.state === OPEN && (
                          <button
                            onClick={() => handleCancelTask(task.id)}
                            className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            Cancel
                          </button>
                        )}

                        {task.state === REVIEW && (
                          <button
                            onClick={() => handleApproveRelease(task.id)}
                            className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Approve & Release
                          </button>
                        )}

                        {canReclaim && (
                          <button
                            onClick={() => handleReclaim(task.id)}
                            className="px-3 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                          >
                            Reclaim After Timeout
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Your Bids</h2>
            {myBids.length === 0 ? (
              <p className="text-gray-600">You haven't submitted any bids yet.</p>
            ) : (
              <div className="grid gap-4">
                {myBids.map((bid) => (
                  <div key={`${bid.taskId}-${bid.worker}`} className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold">Task #{bid.taskId}</p>
                    <p className="text-sm text-gray-600">Bid Price: {(Number(bid.proposedPrice) / 1e18).toFixed(4)} MON</p>
                    <p className="text-xs text-gray-500 mt-2">Proposal CID: {bid.proposalCid}</p>
                    <Link href={`/tasks/${bid.taskId}`} className="inline-block mt-3 text-sm text-blue-700 hover:underline">
                      Open task details
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-6">Pending Withdrawals</h2>

            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6">
              <p className="text-sm text-gray-600 mb-2">Available Balance</p>
              <p className="text-3xl font-bold text-blue-600">
                {balanceInMON.toFixed(6)} MON
              </p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={balanceInMON === 0}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Withdraw {balanceInMON.toFixed(6)} MON
            </button>

            <p className="text-xs text-gray-500 mt-4">
              Withdrawals use a pull-payment pattern and are protected against reentrancy attacks.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
