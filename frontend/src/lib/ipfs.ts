/**
 * IPFS pinning and fetching utilities with multi-provider support.
 *
 * Providers:
 *   - Pinata (production, recommended)
 *   - nft.storage (legacy fallback)
 *
 * Gateway:
 *   - Cloudflare IPFS gateway for reads
 */

// --- Constants ---

const IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs'
const NFT_STORAGE_API = 'https://api.nft.storage/upload'
const PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'
const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_UNPIN_URL = 'https://api.pinata.cloud/pinning/unpin'

const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

type IPFSProvider = 'pinata' | 'nftstorage'

// --- Provider Selection ---

/**
 * Determine which IPFS provider to use based on environment config.
 * Defaults to 'pinata' if not set.
 */
function getProvider(): IPFSProvider {
  const provider = process.env.NEXT_PUBLIC_IPFS_PROVIDER
  if (provider === 'nftstorage') return 'nftstorage'
  return 'pinata'
}

// --- Retry Helper ---

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries - 1) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(
          `[IPFS] ${label} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`,
          lastError.message
        )
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw new Error(`[IPFS] ${label} failed after ${maxRetries} attempts: ${lastError?.message}`)
}

// --- CID Validation ---

/**
 * Basic CID validation. Checks that the string looks like a valid CIDv0 or CIDv1.
 */
export function isValidCID(cid: string): boolean {
  if (!cid || typeof cid !== 'string') return false
  // CIDv0: starts with Qm, 46 chars
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) return true
  // CIDv1: starts with b, variable length base32
  if (/^b[a-z2-7]{58,}$/i.test(cid)) return true
  // CIDv1 base58btc: starts with z
  if (/^z[1-9A-HJ-NP-Za-km-z]+$/.test(cid)) return true
  // Relaxed: allow bafy... CIDs
  if (/^bafy[a-z2-7]+$/i.test(cid)) return true
  return false
}

// --- Pinata Provider ---

/**
 * Pin JSON metadata to Pinata.
 */
async function pinToPinata(
  metadata: Record<string, unknown>,
  name?: string
): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY
  const secretKey = process.env.PINATA_SECRET_API_KEY || process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY

  if (!apiKey || !secretKey) {
    throw new Error('Pinata API keys not configured. Set PINATA_API_KEY and PINATA_SECRET_API_KEY.')
  }

  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: {
      name: name || `gig-platform-${Date.now()}`,
    },
  })

  const resp = await fetch(PINATA_PIN_JSON_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body,
  })

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => 'unknown error')
    throw new Error(`Pinata pin failed: ${resp.status} ${resp.statusText} — ${errorText}`)
  }

  const data = await resp.json()
  return data.IpfsHash
}

/**
 * Unpin content from Pinata.
 */
export async function unpinFromPinata(cid: string): Promise<void> {
  const apiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY
  const secretKey = process.env.PINATA_SECRET_API_KEY || process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY

  if (!apiKey || !secretKey) {
    throw new Error('Pinata API keys not configured.')
  }

  const resp = await fetch(`${PINATA_UNPIN_URL}/${cid}`, {
    method: 'DELETE',
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
  })

  if (!resp.ok) {
    throw new Error(`Pinata unpin failed: ${resp.status} ${resp.statusText}`)
  }
}

// --- nft.storage Provider ---

/**
 * Pin JSON metadata to nft.storage.
 */
async function pinToNFTStorage(metadata: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.NFT_STORAGE_API_KEY || process.env.NEXT_PUBLIC_NFT_STORAGE_API_KEY
  if (!apiKey) {
    throw new Error('NFT_STORAGE_API_KEY not configured.')
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

// --- Public API ---

/**
 * Upload JSON metadata to IPFS using the configured provider.
 * Includes automatic retry with exponential backoff.
 *
 * @param metadata  Object to pin to IPFS
 * @param name      Optional name for the pin (Pinata only)
 * @returns         IPFS CID
 */
export async function pinToIPFS(
  metadata: Record<string, unknown>,
  name?: string
): Promise<string> {
  const provider = getProvider()

  return withRetry(async () => {
    let cid: string
    if (provider === 'pinata') {
      cid = await pinToPinata(metadata, name)
    } else {
      cid = await pinToNFTStorage(metadata)
    }

    if (!cid) {
      throw new Error('Pinning returned empty CID')
    }

    return cid
  }, `pinToIPFS (${provider})`)
}

/**
 * Upload a File object to Pinata.
 * Useful for uploading deliverable files, profile images, etc.
 *
 * @param file  File to upload
 * @param name  Optional name for the pin
 * @returns     IPFS CID
 */
export async function pinFileToIPFS(file: File, name?: string): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY
  const secretKey = process.env.PINATA_SECRET_API_KEY || process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY

  if (!apiKey || !secretKey) {
    throw new Error('Pinata API keys not configured.')
  }

  return withRetry(async () => {
    const formData = new FormData()
    formData.append('file', file)

    if (name) {
      formData.append(
        'pinataMetadata',
        JSON.stringify({ name })
      )
    }

    const resp = await fetch(PINATA_PIN_FILE_URL, {
      method: 'POST',
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
      },
      body: formData,
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'unknown error')
      throw new Error(`Pinata file pin failed: ${resp.status} ${resp.statusText} — ${errorText}`)
    }

    const data = await resp.json()
    return data.IpfsHash
  }, 'pinFileToIPFS')
}

/**
 * Fetch JSON content from IPFS via Cloudflare gateway.
 * Includes retry logic for gateway timeouts.
 *
 * @param cid  IPFS CID
 * @returns    Parsed JSON content
 */
export async function fetchFromIPFS<T = unknown>(cid: string): Promise<T> {
  if (!cid) {
    throw new Error('CID is required for IPFS fetch')
  }

  return withRetry(async () => {
    const url = `${IPFS_GATEWAY}/${cid}`
    const resp = await fetch(url)

    if (!resp.ok) {
      throw new Error(`IPFS fetch failed: ${resp.status} ${resp.statusText} (CID: ${cid})`)
    }

    return resp.json()
  }, `fetchFromIPFS(${cid})`)
}

/**
 * Build a full IPFS gateway URL for a CID.
 */
export function ipfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}/${cid}`
}

/**
 * Build an ipfs:// protocol URI.
 */
export function ipfsUri(cid: string): string {
  return `ipfs://${cid}`
}
