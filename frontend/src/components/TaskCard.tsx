import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchFromIPFS } from '@/lib/ipfs'

export interface TaskCardData {
  taskId: number
  poster: string
  budget: bigint
  deadline: number
  metadataCid: string
}

/**
 * TaskCard — displays task summary (budget, deadline, poster)
 * Lazy-fetches title from IPFS on expand
 */
export default function TaskCard({ task }: { task: TaskCardData }) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (expanded && !title && task.metadataCid) {
      setLoading(true)
      fetchFromIPFS<{ title?: string }>(task.metadataCid)
        .then((metadata) => setTitle(metadata.title || 'Untitled'))
        .catch((err) => {
          console.error('Failed to fetch task metadata:', err)
          setTitle('Title unavailable')
        })
        .finally(() => setLoading(false))
    }
  }, [expanded, title, task.metadataCid])

  const deadlineDate = new Date(task.deadline * 1000)
  const formatBudget = (value: bigint) => {
    const inEther = Number(value) / 1e18
    return `${inEther.toFixed(3)} MON`
  }

  return (
    <Link href={`/tasks/${task.taskId}`}>
      <div className="p-4 border border-gray-200 rounded hover:shadow-md cursor-pointer transition">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {expanded && loading && <p className="text-sm text-gray-500">Loading...</p>}
            <p className="text-sm text-gray-600">
              Poster: {task.poster.slice(0, 6)}...{task.poster.slice(-4)}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              setExpanded(!expanded)
            }}
            className="ml-4 px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>

        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-gray-700">
            <strong>Budget:</strong> {formatBudget(task.budget)}
          </span>
          <span className="text-gray-700">
            <strong>Due:</strong> {deadlineDate.toLocaleDateString()}
          </span>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
            <p>CID: {task.metadataCid}</p>
          </div>
        )}
      </div>
    </Link>
  )
}
