'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { TASK_ESCROW } from '@/lib/contracts'
import { useRouter, useParams } from 'next/navigation'
import { useTaskDetail, useTaskBids, useTaskMetadata, useIsWorkerRegistered } from '@/lib/taskDetailHooks'
import { pinToIPFS } from '@/lib/ipfs'
import TaskStateDisplay from '@/components/TaskStateDisplay'
import BidForm from '@/components/BidForm'
import DeliverableForm from '@/components/DeliverableForm'

const STATE_NAMES = ['OPEN', 'ASSIGNED', 'REVIEW', 'CLOSED', 'CANCELLED']

export default function TaskDetailPage() {
  const router = useRouter()
  const params = useParams()
  const taskId = Number(params.id)
  const { address } = useAccount()
  const { task, isLoading: taskLoading } = useTaskDetail(taskId)
  const bids = useTaskBids(taskId)
  const { metadata, loading: metadataLoading } = useTaskMetadata(task?.metadataCid)
  const isWorkerRegistered = useIsWorkerRegistered(address)

  const { writeContract: assignWorker } = useWriteContract()
  const { writeContract: approveAndRelease } = useWriteContract()

  const [selectedBidWorker, setSelectedBidWorker] = useState<string | null>(null)

  if (taskLoading) {
    return <div className="p-8 text-center">Loading task...</div>
  }

  if (!task) {
    return <div className="p-8 text-center text-red-600">Task not found</div>
  }

  const taskState = task.state
  const isPoster = address?.toLowerCase() === task.poster.toLowerCase()
  const isAssignedWorker = address?.toLowerCase() === task.worker.toLowerCase()
  const isOpen = taskState === 0
  const isAssigned = taskState === 1
  const isReview = taskState === 2

  const handleAssignWorker = (workerAddress: string) => {
    assignWorker({
      ...TASK_ESCROW,
      functionName: 'assignWorker',
      args: [BigInt(taskId), workerAddress as `0x${string}`],
    })
  }

  const handleApproveAndRelease = () => {
    approveAndRelease({
      ...TASK_ESCROW,
      functionName: 'approveAndRelease',
      args: [BigInt(taskId)],
    })
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <button
            onClick={() => router.push('/')}
            className="mb-4 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            ← Back to Feed
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {metadata?.title || 'Task'}
              </h1>
              <p className="text-gray-600 mb-4">
                Task #{taskId} • Posted by {task.poster.slice(0, 6)}...{task.poster.slice(-4)}
              </p>
            </div>
            <TaskStateDisplay state={taskState} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-sm text-gray-600">Budget</p>
              <p className="text-lg font-semibold">
                {(Number(task.budget) / 1e18).toFixed(3)} MON
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Deadline</p>
              <p className="text-lg font-semibold">
                {new Date(task.deadline * 1000).toLocaleDateString()}
              </p>
            </div>
            {isAssigned && task.worker !== '0x0000000000000000000000000000000000000000' && (
              <div>
                <p className="text-sm text-gray-600">Assigned Worker</p>
                <p className="text-lg font-semibold">
                  {task.worker.slice(0, 6)}...{task.worker.slice(-4)}
                </p>
              </div>
            )}
            {isReview && (
              <div>
                <p className="text-sm text-gray-600">Review Deadline</p>
                <p className="text-lg font-semibold">
                  {new Date(task.reviewDeadline * 1000).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {metadata && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold mb-4">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {metadata.description}
            </p>
            {metadata.skills && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {metadata.skills.map((skill: number) => (
                    <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      Skill {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bids Section */}
        {isOpen && bids.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold mb-4">Submitted Bids ({bids.length})</h2>
            <div className="space-y-3">
              {bids.map((bid) => (
                <div key={bid.worker} className="flex items-center justify-between p-4 border border-gray-100 rounded hover:bg-gray-50">
                  <div>
                    <p className="font-semibold">{bid.worker.slice(0, 6)}...{bid.worker.slice(-4)}</p>
                    <p className="text-sm text-gray-600">Price: {(Number(bid.proposedPrice) / 1e18).toFixed(3)} MON</p>
                    <p className="text-xs text-gray-500">CID: {bid.proposalCid.slice(0, 20)}...</p>
                  </div>
                  {isPoster && (
                    <button
                      onClick={() => handleAssignWorker(bid.worker)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Assign
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deliverable Section */}
        {isReview && task.deliverableCid && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold mb-4">Deliverable</h2>
            <p className="text-gray-700 mb-4">CID: {task.deliverableCid}</p>
            {isPoster && (
              <button
                onClick={handleApproveAndRelease}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Approve & Release Payment
              </button>
            )}
          </div>
        )}

        {/* Action Forms */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Bid Form */}
          {isOpen && isWorkerRegistered && !isPoster && address && (
            <BidForm taskId={taskId} budget={task.budget} />
          )}

          {/* Deliverable Form */}
          {isAssigned && isAssignedWorker && address && (
            <DeliverableForm taskId={taskId} />
          )}
        </div>
      </div>
    </main>
  )
}
