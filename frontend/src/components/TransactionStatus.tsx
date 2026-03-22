'use client'

import Link from 'next/link'

interface TransactionStatusProps {
  hash?: string
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  error?: Error | null
  explorerUrl?: string
}

/**
 * TransactionStatus — displays pending, confirmed, or failed TX state
 * with link to explorer for viewing details on-chain
 */
export default function TransactionStatus({
  hash,
  isPending,
  isSuccess,
  isError,
  error,
  explorerUrl = 'https://monadvision.com',
}: TransactionStatusProps) {
  if (!hash && !isPending && !isSuccess && !isError) {
    return null
  }

  const txLink = hash ? `${explorerUrl}/tx/${hash}` : '#'

  if (isPending) {
    return (
      <div className="p-4 bg-blue-100 text-blue-800 rounded flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-spin"></div>
          <span>Transaction pending...</span>
        </div>
        {hash && (
          <Link href={txLink} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:no-underline">
            View on explorer
          </Link>
        )}
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="p-4 bg-green-100 text-green-800 rounded flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">✓</span>
          <span>Transaction confirmed!</span>
        </div>
        {hash && (
          <Link href={txLink} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:no-underline">
            View on explorer
          </Link>
        )}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded">
        <p className="font-semibold">Transaction failed</p>
        {error && <p className="text-sm mt-1">{error.message}</p>}
        {hash && (
          <Link href={txLink} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:no-underline block mt-2">
            View on explorer
          </Link>
        )}
      </div>
    )
  }

  return null
}
