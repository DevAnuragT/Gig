'use client'

export default function TaskStateDisplay({ state }: { state: number }) {
  const states = [
    { name: 'OPEN', color: 'bg-blue-100 text-blue-800' },
    { name: 'ASSIGNED', color: 'bg-yellow-100 text-yellow-800' },
    { name: 'REVIEW', color: 'bg-purple-100 text-purple-800' },
    { name: 'CLOSED', color: 'bg-green-100 text-green-800' },
    { name: 'CANCELLED', color: 'bg-red-100 text-red-800' },
  ]

  const current = states[state] || states[0]

  return (
    <div className={`px-4 py-2 rounded font-semibold ${current.color}`}>
      {current.name}
    </div>
  )
}
