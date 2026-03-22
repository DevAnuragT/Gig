'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { TASK_ESCROW } from '@/lib/contracts'
import { pinToIPFS } from '@/lib/ipfs'
import { monadTestnet } from '@/lib/wagmi'
import TransactionStatus from './TransactionStatus'

export default function DeliverableForm({ taskId }: { taskId: number }) {
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { writeContract: submitDeliverable, isPending: isTxPending } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmedError,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTxHash(undefined)

    try {
      const deliverableCid = await pinToIPFS({
        version: '1.0',
        summary,
        notes,
      })

      submitDeliverable(
        {
          ...TASK_ESCROW,
          functionName: 'submitDeliverable',
          args: [BigInt(taskId), deliverableCid],
        },
        {
          onSuccess: (hash) => {
            setTxHash(hash)
            setSummary('')
            setNotes('')
          },
          onError: (err) => {
            setError(err.message || 'Failed to submit deliverable')
          },
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit deliverable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Submit Deliverable</h2>

      {txHash && (
        <TransactionStatus
          hash={txHash}
          isPending={isTxPending || isConfirming}
          isSuccess={isConfirmed}
          isError={isConfirmedError}
          error={confirmError}
          explorerUrl={monadTestnet.blockExplorers?.default?.url}
        />
      )}

      {error && !txHash && (
        <div className="p-4 bg-red-100 text-red-800 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary of the deliverable..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes, file references (IPFS CIDs), or context..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={loading || isTxPending || isConfirming}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading || isTxPending ? 'Submitting...' : isConfirming ? 'Confirming...' : 'Submit Deliverable'}
        </button>
      </form>
    </div>
  )
}
