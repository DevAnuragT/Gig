'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { useParams } from 'next/navigation'
import { WORKER_REGISTRY } from '@/lib/contracts'
import { pinToIPFS } from '@/lib/ipfs'
import SkillTags from '@/components/SkillTags'

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

interface WorkerData {
  nameHash: string
  skillBitmask: bigint
  registered: boolean
}

export default function WorkerProfilePage() {
  const params = useParams()
  const workerAddress = typeof params.address === 'string' ? params.address : params.address?.[0]
  const { address: connectedAddress } = useAccount()
  const isOwnProfile = connectedAddress?.toLowerCase() === workerAddress?.toLowerCase()

  const { data: worker } = useReadContract({
    ...WORKER_REGISTRY,
    functionName: 'workers',
    args: workerAddress ? [workerAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(workerAddress) },
  })

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { writeContract: registerWorker } = useWriteContract()
  const { writeContract: updateSkills } = useWriteContract()

  const handleSelectSkill = (skillId: number) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    )
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName) {
      setError('Display name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Upload profile to IPFS
      const profileCid = await pinToIPFS({
        version: '1.0',
        displayName,
        bio,
      })

      // Calculate skill bitmask
      const skillBitmask = selectedSkills.reduce((mask, skillId) => {
        return mask | (BigInt(1) << BigInt(skillId))
      }, BigInt(0))

      // Hash display name (keccak256)
      const nameHash = `0x${Array.from(displayName).reduce(
        (hash, char) => hash + char.charCodeAt(0).toString(16),
        ''
      ).padEnd(64, '0')}`

      registerWorker({
        ...WORKER_REGISTRY,
        functionName: 'registerWorker',
        args: [nameHash as `0x${string}`, skillBitmask],
      })

      setSuccess(true)
      setDisplayName('')
      setBio('')
      setSelectedSkills([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSkills = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const skillBitmask = selectedSkills.reduce((mask, skillId) => {
        return mask | (BigInt(1) << BigInt(skillId))
      }, BigInt(0))

      updateSkills({
        ...WORKER_REGISTRY,
        functionName: 'updateSkills',
        args: [skillBitmask],
      })

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skills')
    } finally {
      setLoading(false)
    }
  }

  const workerData = worker as WorkerData | undefined
  const isRegistered = workerData?.registered

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {workerAddress ? `${workerAddress.slice(0, 10)}...${workerAddress.slice(-8)}` : 'Worker Profile'}
          </h1>

          {isRegistered ? (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded">
              ✓ Registered as a Worker
            </div>
          ) : (
            <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded">
              Not yet registered
            </div>
          )}

          {isRegistered && workerData && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Skills</p>
              <SkillTags skillBitmask={workerData.skillBitmask} />
            </div>
          )}
        </div>

        {/* Registration/Update Form */}
        {isOwnProfile && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-6">
              {isRegistered ? 'Update Your Skills' : 'Register as a Worker'}
            </h2>

            {success && (
              <div className="p-4 bg-green-100 text-green-800 rounded mb-4">
                ✓ {isRegistered ? 'Skills updated' : 'Registration complete'}!
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-100 text-red-800 rounded mb-4">
                {error}
              </div>
            )}

            <form
              onSubmit={isRegistered ? handleUpdateSkills : handleRegister}
              className="space-y-6"
            >
              {!isRegistered && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name or nickname"
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell posters about yourself and your experience..."
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {isRegistered ? 'Update Your Skills' : 'Your Skills'}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(SKILL_NAMES).map(([id, name]) => (
                    <label key={id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSkills.includes(Number(id))}
                        onChange={() => handleSelectSkill(Number(id))}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : isRegistered ? 'Update Skills' : 'Register'}
              </button>
            </form>
          </div>
        )}

        {!isOwnProfile && !isRegistered && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-600">This worker has not yet registered.</p>
          </div>
        )}
      </div>
    </main>
  )
}
