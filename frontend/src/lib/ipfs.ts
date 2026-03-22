/**
 * IPFS and nft.storage utilities for pinning and fetching content
 */

const IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs'
const NFT_STORAGE_API = 'https://api.nft.storage/upload'

/**
 * Upload JSON metadata to nft.storage and return the CID
 * @param metadata Object to pin to IPFS
 * @returns IPFS CID
 */
export async function pinToIPFS(metadata: Record<string, any>): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_NFT_STORAGE_API_KEY
  if (!apiKey) {
    throw new Error('NFT_STORAGE_API_KEY not configured')
  }

  const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  const formData = new FormData()
  formData.append('file', blob)

  const resp = await fetch(NFT_STORAGE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!resp.ok) {
    throw new Error(`nft.storage upload failed: ${resp.status} ${resp.statusText}`)
  }

  const data = await resp.json()
  return data.value.cid
}

/**
 * Fetch JSON content from IPFS via Cloudflare gateway
 * @param cid IPFS CID
 * @returns Parsed JSON content
 */
export async function fetchFromIPFS<T = any>(cid: string): Promise<T> {
  const url = `${IPFS_GATEWAY}/${cid}`

  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`IPFS fetch failed: ${resp.status} ${resp.statusText} (CID: ${cid})`)
  }

  return resp.json()
}
