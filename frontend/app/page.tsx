'use client'

import { useState, useMemo } from 'react'
import TaskCard, { TaskCardData } from '@/components/TaskCard'
import { useTaskFeed, type IndexedTask } from '@/lib/taskStore'

export default function Home() {
  const tasks = useTaskFeed()
  const [minBudget, setMinBudget] = useState<number>(0)
  const [skillFilter, setSkillFilter] = useState<number>(0)
  const [deadlineRange, setDeadlineRange] = useState<'all' | '7days' | '30days'>('all')

  const filteredTasks = useMemo(() => {
    const now = Date.now() / 1000

    return tasks.filter((task) => {
      if (Number(task.budget) / 1e18 < minBudget) return false

      if (deadlineRange !== 'all') {
        const daysMs = deadlineRange === '7days' ? 7 * 86400 : 30 * 86400
        if (task.deadline > now + daysMs) return false
      }

      return true
    })
  }, [tasks, minBudget, deadlineRange])

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Task Feed</h1>
        <p className="text-gray-600 mb-8">Discover tasks on Monad testnet</p>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Budget (MON)
              </label>
              <input
                type="number"
                value={minBudget}
                onChange={(e) => setMinBudget(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline
              </label>
              <select
                value={deadlineRange}
                onChange={(e) => setDeadlineRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="all">All</option>
                <option value="7days">Next 7 days</option>
                <option value="30days">Next 30 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Found: {filteredTasks.length}
              </label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                {filteredTasks.length > 0
                  ? `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`
                  : 'No tasks match filters'}
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={
                  {
                    taskId: task.taskId,
                    poster: task.poster,
                    budget: task.budget,
                    deadline: task.deadline,
                    metadataCid: task.metadataCid,
                  } as TaskCardData
                }
              />
            ))
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
              {tasks.length === 0
                ? 'Loading tasks...'
                : 'No tasks match your filters'}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
