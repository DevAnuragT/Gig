import { defineChain } from 'viem'
import { http, createConfig } from 'wagmi'

/**
 * Monad testnet chain configuration (chainId 143)
 */
export const monadTestnet = defineChain({
  id: 143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadVision',
      url: 'https://monadvision.com',
    },
    monadScan: {
      name: 'MonadScan',
      url: 'https://monadscan.com',
    },
  },
})

/**
 * Wagmi config — uses browser wallet provider
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [],
  transports: {
    [monadTestnet.id]: http(),
  },
})

export default wagmiConfig
