'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi'
import { useRouter } from 'next/navigation'
import { TASK_ESCROW, WORKER_REGISTRY } from '@/lib/contracts'
import { fetchFromIPFS } from '@/lib/ipfs'
import TaskCard from '@/components/TaskCard'
import TaskStateDisplay from '@/components/TaskStateDisplay'

interface Task {
  id: bigint
  poster: string
  worker: string
  metadataCid: string
  budget: bigint
  deadline: bigint
  state: number
  deliveryCid: string
}

interface Bid {
  id: bigint
  taskId: bigint
  worker: string
  proposalCid: string
  price: bigint
  timestamp: bigint
  accepted: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const { address: connectedAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'tasks' | 'bids' | 'withdrawals'>('tasks')

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

  const { writeContract: withdraw } = useWriteContract()

  // Watch for BidSubmitted events (for worker tabs)
  const [bids, setBids] = useState<Bid[]>([])
  useWatchContractEvent({
    ...TASK_ESCROW,
    eventName: 'BidSubmitted',
    onLogs: (logs: any[]) => {
      logs.forEach((log) => {
        const bid: Bid = {
          id: log.args?.bidId || BigInt(0),
          taskId: log.args?.taskId || BigInt(0),
          worker: log.args?.worker || '',
          proposalCid: log.args?.proposalCid || '',
          price: log.args?.price || BigInt(0),
          timestamp: log.args?.timestamp || BigInt(0),
          accepted: log.args?.accepted || false,
        }
        setBids((prev) => [...prev, bid])
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

  // Filter bids for current user
  const myBids = bids.filter((bid) => bid.worker.toLowerCase() === connectedAddress?.toLowerCase())

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
            <p className="text-gray-600">Your posted tasks will appear here (event-based loading not yet fully implemented)</p>
            <p className="text-sm text-gray-500">Use the task feed on the homepage to find your tasks, or navigate directly to task details.</p>
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
                  <div key={bid.id} className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold">Task {bid.taskId.toString()}</p>
                    <p className="text-sm text-gray-600">Bid Price: {(Number(bid.price) / 1e18).toFixed(4)} MON</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Status: {bid.accepted ? '✓ Accepted' : 'Pending'}
                    </p>
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
