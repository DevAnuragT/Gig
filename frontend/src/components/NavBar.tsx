import Link from 'next/link'
import ConnectButton from './ConnectButton'

/**
 * NavBar — top navigation with links and wallet connection button
 */
export default function NavBar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-2xl font-bold text-gray-900">
          Gig
        </Link>
        <div className="flex gap-6">
          <Link href="/" className="text-gray-700 hover:text-gray-900">
            Feed
          </Link>
          <Link href="/tasks/create" className="text-gray-700 hover:text-gray-900">
            Create Task
          </Link>
          <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
            Dashboard
          </Link>
        </div>
      </div>
      <ConnectButton />
    </nav>
  )
}
