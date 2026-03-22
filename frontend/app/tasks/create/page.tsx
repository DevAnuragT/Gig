'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useRouter } from 'next/navigation'
import { TASK_ESCROW } from '@/lib/contracts'
import { pinToIPFS } from '@/lib/ipfs'
import { monadTestnet } from '@/lib/wagmi'

interface TaskFormData {
  title: string
  description: string
  skills: number[]
  budget: string
  deadline: string
}

const SKILL_NAMES: Record<number, string> = {
  0: 'Smart Contract Development',
  1: 'Frontend Development',
  2: 'Backend Development',
  3: 'UI/UX Design',
  4: 'Security Audit',
  5: 'Technical Writing',
  6: 'Data Labeling',
  7: 'QA/Testing',
}

export default function CreateTaskPage() {
  const router = useRouter()
  const { address } = useAccount()
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    skills: [],
    budget: '',
    deadline: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { writeContract: createTask } = useWriteContract()

  if (!address) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
            <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
            <p className="text-gray-600">
              You must connect your wallet to create a task.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const toggleSkill = (skillId: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter((s) => s !== skillId)
        : [...prev.skills, skillId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.title || !formData.description || !formData.budget || !formData.deadline) {
        setError('Please fill in all fields')
        return
      }

      const budgetInWei = BigInt(Math.floor(Number(formData.budget) * 1e18))
      const maxTaskValue = BigInt('1000000000000000000') // 1 ether

      if (budgetInWei > maxTaskValue) {
        setError('Budget exceeds maximum task value (1 MON)')
        return
      }

      const deadlineTime = new Date(formData.deadline).getTime() / 1000
      if (deadlineTime <= Date.now() / 1000) {
        setError('Deadline must be in the future')
        return
      }

      const metadataCid = await pinToIPFS({
        version: '1.0',
        title: formData.title,
        description: formData.description,
        skills: formData.skills,
      })

      createTask({
        ...TASK_ESCROW,
        functionName: 'createTask',
        args: [metadataCid, BigInt(Math.floor(deadlineTime))],
        value: budgetInWei,
      })

      // Redirect after successful submission
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Create a New Task</h1>

        {error && (
          <div className="p-4 bg-red-100 text-red-800 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Build a smart contract for token staking"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the task, requirements, and deliverables..."
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={6}
              required
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Required Skills
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(SKILL_NAMES).map(([id, name]) => (
                <label key={id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.skills.includes(Number(id))}
                    onChange={() => toggleSkill(Number(id))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget (MON) *
            </label>
            <input
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              placeholder="0.5"
              step="0.001"
              min="0"
              max="1"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Maximum: 1 MON</p>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline *
            </label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Task...' : 'Create Task'}
          </button>
        </form>
      </div>
    </main>
  )
}
