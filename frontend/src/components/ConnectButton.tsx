import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { monadTestnet } from '@/lib/wagmi'

declare global {
  interface Window {
    ethereum?: any
  }
}

/**
 * ConnectButton — shows wallet address when connected, or a connect prompt
 * Prompts to add Monad testnet if needed via wallet_addEthereumChain
 */
export default function ConnectButton() {
  const { address, chainId } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnect = async () => {
    if (!window.ethereum) {
      alert('MetaMask not detected. Please install MetaMask.')
      return
    }

    try {
      await window.ethereum.request({
        method: 'eth_requestAccounts',
      })
    } catch (error) {
      console.error('Connect failed:', error)
    }
  }

  const handleAddNetwork = async () => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${monadTestnet.id.toString(16)}`,
            chainName: monadTestnet.name,
            rpcUrls: [monadTestnet.rpcUrls.default.http[0]],
            nativeCurrency: monadTestnet.nativeCurrency,
            blockExplorerUrls: [monadTestnet.blockExplorers?.default?.url],
          },
        ],
      })
    } catch (error) {
      console.error('Failed to add network:', error)
    }
  }

  if (!mounted) return null

  if (address && chainId === monadTestnet.id) {
    return (
      <div className="px-4 py-2 bg-green-100 text-green-800 rounded border border-green-300">
        {address.slice(0, 6)}...{address.slice(-4)}
      </div>
    )
  }

  if (address && chainId !== monadTestnet.id) {
    return (
      <button
        onClick={handleAddNetwork}
        className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded border border-yellow-300 hover:bg-yellow-200"
      >
        Switch to Monad Testnet
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Connect Wallet
    </button>
  )
}
