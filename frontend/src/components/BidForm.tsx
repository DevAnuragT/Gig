'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { TASK_ESCROW } from '@/lib/contracts'
import { pinToIPFS } from '@/lib/ipfs'

export default function BidForm({ taskId, budget }: { taskId: number; budget: bigint }) {
  const [proposal, setProposal] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { writeContract: submitBid } = useWriteContract()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const priceInWei = BigInt(Math.floor(Number(price) * 1e18))

      if (priceInWei > budget) {
        setError('Bid price exceeds task budget')
        return
      }

      const proposalCid = await pinToIPFS({
        version: '1.0',
        proposal,
      })

      submitBid({
        ...TASK_ESCROW,
        functionName: 'submitBid',
        args: [BigInt(taskId), proposalCid, priceInWei],
      })

      setSuccess(true)
      setProposal('')
      setPrice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Submit Your Bid</h2>

      {success && (
        <div className="p-4 bg-green-100 text-green-800 rounded mb-4">
          ✓ Bid submitted successfully!
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proposal / Notes
          </label>
          <textarea
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            placeholder="Describe your proposal, timeline, and approach..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Bid Price (MON)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.0"
            step="0.001"
            min="0"
            max={Number(budget) / 1e18}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Max: {(Number(budget) / 1e18).toFixed(3)} MON
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Bid'}
        </button>
      </form>
    </div>
  )
}
