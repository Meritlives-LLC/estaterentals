// backend/src/lib/bunny.ts
import crypto from 'crypto'

const BUNNY_API_KEY = process.env.BUNNY_API_KEY
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME // e.g. vz-xxxxx.b-cdn.net

const BASE_URL = 'https://video.bunnycdn.com'

function assertBunnyConfig() {
  if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
    throw new Error('Bunny Stream is not configured. Set BUNNY_API_KEY and BUNNY_LIBRARY_ID.')
  }
}

/**
 * Create a video object in Bunny Stream (does not upload the file).
 * Returns the video GUID and metadata needed for TUS upload.
 */
export async function createBunnyVideo(title: string): Promise<{
  videoId: string
  libraryId: string
  title: string
}> {
  assertBunnyConfig()

  const res = await fetch(`${BASE_URL}/library/${BUNNY_LIBRARY_ID}/videos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      AccessKey: BUNNY_API_KEY!,
    },
    body: JSON.stringify({ title }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[Bunny] Create video failed:', res.status, text)
    throw new Error('Failed to create video on Bunny Stream')
  }

  const data = (await res.json()) as { guid: string; title?: string }
  return {
    videoId: data.guid,
    libraryId: BUNNY_LIBRARY_ID!,
    title: data.title ?? title,
  }
}

/**
 * Generate TUS upload authorization signature.
 * Signature = SHA256(libraryId + apiKey + expirationTime + videoId)
 */
export function generateTusSignature(videoId: string, expiresInSeconds = 3600): {
  signature: string
  expirationTime: number
  libraryId: string
  videoId: string
} {
  assertBunnyConfig()

  const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds
  const signatureString = `${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expirationTime}${videoId}`
  const signature = crypto.createHash('sha256').update(signatureString).digest('hex')

  return {
    signature,
    expirationTime,
    libraryId: BUNNY_LIBRARY_ID!,
    videoId,
  }
}

/**
 * Delete a video from Bunny Stream by GUID.
 */
export async function deleteBunnyVideo(videoId: string): Promise<void> {
  assertBunnyConfig()

  const res = await fetch(`${BASE_URL}/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      AccessKey: BUNNY_API_KEY!,
    },
  })

  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    console.error('[Bunny] Delete video failed:', res.status, text)
    throw new Error('Failed to delete video from Bunny Stream')
  }
}

/**
 * Fetch video details from Bunny (status, duration, thumbnail, etc.)
 */
export async function getBunnyVideo(videoId: string): Promise<{
  videoId: string
  title: string
  length: number
  status: number
  thumbnailUrl: string | null
  width?: number
  height?: number
  storageSize?: number
} | null> {
  assertBunnyConfig()

  const res = await fetch(`${BASE_URL}/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      AccessKey: BUNNY_API_KEY!,
    },
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    console.error('[Bunny] Get video failed:', res.status, text)
    throw new Error('Failed to fetch video from Bunny Stream')
  }

  const data = (await res.json()) as {
    guid: string
    title: string
    length: number
    status: number
    thumbnailFileName?: string
    width?: number
    height?: number
    storageSize?: number
  }

  let thumbnailUrl: string | null = null
  if (BUNNY_CDN_HOSTNAME && data.thumbnailFileName) {
    thumbnailUrl = `https://${BUNNY_CDN_HOSTNAME}/${data.guid}/${data.thumbnailFileName}`
  } else if (BUNNY_CDN_HOSTNAME) {
    // Default thumbnail path used by Bunny
    thumbnailUrl = `https://${BUNNY_CDN_HOSTNAME}/${data.guid}/thumbnail.jpg`
  }

  return {
    videoId: data.guid,
    title: data.title,
    length: data.length,
    status: data.status,
    thumbnailUrl,
    width: data.width,
    height: data.height,
    storageSize: data.storageSize,
  }
}

/**
 * Build a public playback / embed URL for a video.
 * Prefer iframe embed for adaptive streaming.
 */
export function getBunnyPlaybackUrl(videoId: string): string {
  // Standard Bunny Stream embed URL
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`
}

export function getBunnyHlsUrl(videoId: string): string | null {
  if (!BUNNY_CDN_HOSTNAME) return null
  return `https://${BUNNY_CDN_HOSTNAME}/${videoId}/playlist.m3u8`
}

export function isBunnyConfigured(): boolean {
  return Boolean(BUNNY_API_KEY && BUNNY_LIBRARY_ID)
}
