'use client'

import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import { TASK_ESCROW } from '@/lib/contracts'
import { pinToIPFS } from '@/lib/ipfs'

export default function DeliverableForm({ taskId }: { taskId: number }) {
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { writeContract: submitDeliverable } = useWriteContract()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const deliverableCid = await pinToIPFS({
        version: '1.0',
        summary,
        notes,
      })

      submitDeliverable({
        ...TASK_ESCROW,
        functionName: 'submitDeliverable',
        args: [BigInt(taskId), deliverableCid],
      })

      setSuccess(true)
      setSummary('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit deliverable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Submit Deliverable</h2>

      {success && (
        <div className="p-4 bg-green-100 text-green-800 rounded mb-4">
          ✓ Deliverable submitted successfully!
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
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Deliverable'}
        </button>
      </form>
    </div>
  )
}
