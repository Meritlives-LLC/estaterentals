/**
 * Bunny Stream TUS resumable upload helper with chunked retries.
 * Requires: npm install tus-js-client
 */
import * as tus from 'tus-js-client'
import { videoApi } from './api'

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm']
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm']
/** Max 500 MB for property walkthrough videos */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024

/** Chunk size for TUS PATCH requests (5 MB) */
export const TUS_CHUNK_SIZE = 5 * 1024 * 1024

/**
 * Delays (ms) between automatic chunk retries inside tus-js-client.
 * First failure retries immediately, then backs off.
 * Length of array = max automatic retries per failing chunk.
 */
export const TUS_CHUNK_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000, 20000, 30000]

/** How many times to restart the whole TUS session (e.g. expired signature) */
export const MAX_UPLOAD_SESSION_RETRIES = 3

export type VideoUploadStatus =
  | 'idle'
  | 'authorizing'
  | 'uploading'
  | 'retrying'
  | 'completing'
  | 'success'
  | 'error'

export interface PendingVideo {
  localId: string
  fileName: string
  fileSize: number
  videoId?: string
  dbId?: string
  title?: string
  thumbnailUrl?: string | null
  url?: string | null
  order: number
  status: VideoUploadStatus
  progress: number
  error?: string
  existing?: boolean
  /** Automatic retry attempt (session-level) */
  retryAttempt?: number
  /** Last reported bytes uploaded (for resume display) */
  bytesUploaded?: number
}

export function validateVideoFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const extOk = ALLOWED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext))
  const mimeOk = !file.type || ALLOWED_VIDEO_MIMES.includes(file.type)

  if (!extOk && !mimeOk) {
    return 'Unsupported format. Use MP4, MOV, or WebM.'
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `File too large. Maximum size is ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB.`
  }
  if (file.size < 1024) {
    return 'File appears empty or invalid.'
  }
  return null
}

export async function checkVideoMagicBytes(file: File): Promise<string | null> {
  const slice = file.slice(0, 12)
  const buf = await slice.arrayBuffer()
  const bytes = new Uint8Array(buf)
  if (bytes.length < 4) return 'Invalid file'

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return null
  }

  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return null
  }

  const lower = file.name.toLowerCase()
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
    return null
  }

  return 'File content does not look like a video (MP4/MOV/WebM).'
}

export interface TusUploadCallbacks {
  onProgress: (percent: number, bytesUploaded: number, bytesTotal: number) => void
  onSuccess: (videoId: string) => void
  onError: (message: string) => void
  /** Fired when tus is about to retry a failed chunk */
  onChunkRetry?: (retryAttempt: number, error: Error) => void
  /** Fired when the whole session is being restarted (new signature) */
  onSessionRetry?: (sessionAttempt: number, reason: string) => void
}

export interface TusUploadHandle {
  videoId: string
  abort: () => void
  done: Promise<string>
}

type BunnyAuth = {
  videoId: string
  libraryId: string
  signature: string
  expirationTime: number
  endpoint: string
  title: string
}

async function fetchUploadAuth(options: {
  title?: string
  propertyId?: string
  /** Reuse an existing Bunny video GUID when refreshing signature (resume) */
  existingVideoId?: string
}): Promise<BunnyAuth> {
  const authRes = await videoApi.getUploadAuth({
    title: options.title,
    propertyId: options.propertyId,
    videoId: options.existingVideoId,
  })

  return authRes.data.data as BunnyAuth
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!error) return true
  const err = error as { message?: string; originalResponse?: Response; status?: number }
  const msg = (err.message || '').toLowerCase()

  // Non-retryable client errors
  if (msg.includes('unsupported') || msg.includes('invalid file')) return false
  if (msg.includes('cancelled') || msg.includes('aborted')) return false

  const status =
    err.status ??
    (err.originalResponse && 'status' in err.originalResponse
      ? (err.originalResponse as Response).status
      : undefined)

  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 413) {
    // Auth / validation — may need a new session rather than chunk retry
    return false
  }

  // 408, 409, 423, 429, 5xx, network failures → retry
  return true
}

function isAuthOrExpiredError(error: unknown): boolean {
  const err = error as { message?: string; originalResponse?: { status?: number }; status?: number }
  const status = err.status ?? err.originalResponse?.status
  const msg = (err.message || '').toLowerCase()
  return (
    status === 401 ||
    status === 403 ||
    msg.includes('authorization') ||
    msg.includes('expired') ||
    msg.includes('signature') ||
    msg.includes('unauthorized')
  )
}

/**
 * Run a single TUS session against Bunny with per-chunk automatic retries.
 */
function runTusSession(
  file: File,
  auth: BunnyAuth,
  callbacks: TusUploadCallbacks,
  signal?: AbortSignal
): { done: Promise<void>; abort: () => void } {
  let uploadRef: tus.Upload | null = null

  const done = new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: auth.endpoint || 'https://video.bunnycdn.com/tusupload',
      // Automatic retries for individual failed chunks
      retryDelays: TUS_CHUNK_RETRY_DELAYS,
      chunkSize: TUS_CHUNK_SIZE,
      // Keep upload URL in localStorage so findPreviousUploads can resume
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      headers: {
        AuthorizationSignature: auth.signature,
        AuthorizationExpire: String(auth.expirationTime),
        LibraryId: String(auth.libraryId),
        VideoId: auth.videoId,
      },
      metadata: {
        filename: file.name,
        filetype: file.type || 'video/mp4',
        title: auth.title || file.name,
      },
      /**
       * Decide whether a failed chunk should be retried by tus-js-client.
       * Return false to stop automatic retries and surface the error.
       */
      onShouldRetry(error, retryAttempt, _options) {
        callbacks.onChunkRetry?.(retryAttempt + 1, error as Error)

        // Don't burn retries on auth failures — outer session will refresh signature
        if (isAuthOrExpiredError(error)) {
          return false
        }

        if (!isRetryableNetworkError(error)) {
          return false
        }

        // retryAttempt is 0-based; allow as many as retryDelays length
        return retryAttempt < TUS_CHUNK_RETRY_DELAYS.length
      },
      onError(error) {
        reject(error)
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent =
          bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0
        callbacks.onProgress(percent, bytesUploaded, bytesTotal)
      },
      onSuccess() {
        resolve()
      },
    })

    uploadRef = upload

    if (signal) {
      const onAbort = () => {
        upload.abort(true).catch(() => {})
        reject(new Error('Upload cancelled'))
      }
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) {
          // Resume from the most recent matching fingerprint (same file)
          upload.resumeFromPreviousUpload(previous[0])
        }
        upload.start()
      })
      .catch((err) => {
        reject(err)
      })
  })

  return {
    done,
    abort: () => {
      uploadRef?.abort(true).catch(() => {})
    },
  }
}

/**
 * 1) Backend creates Bunny video + TUS signature
 * 2) Browser uploads in chunks with automatic per-chunk retries
 * 3) On auth/signature failure, refresh auth and start a new session (up to MAX_UPLOAD_SESSION_RETRIES)
 * 4) Resumes partial uploads via tus fingerprint when possible
 */
export async function startVideoTusUpload(
  file: File,
  options: {
    title?: string
    propertyId?: string
    signal?: AbortSignal
  },
  callbacks: TusUploadCallbacks
): Promise<TusUploadHandle> {
  let aborted = false
  let currentAbort: (() => void) | null = null
  let lastVideoId = ''

  const abort = () => {
    aborted = true
    currentAbort?.()
  }

  if (options.signal) {
    if (options.signal.aborted) {
      throw new Error('Upload cancelled')
    }
    options.signal.addEventListener(
      'abort',
      () => {
        abort()
      },
      { once: true }
    )
  }

  const done = (async () => {
    let lastError: unknown

    for (let attempt = 0; attempt <= MAX_UPLOAD_SESSION_RETRIES; attempt++) {
      if (aborted) throw new Error('Upload cancelled')

      if (attempt > 0) {
        callbacks.onSessionRetry?.(
          attempt,
          lastError instanceof Error ? lastError.message : 'Retrying upload session'
        )
        // Brief pause before re-authorizing
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }

      try {
        const auth = await fetchUploadAuth({
          title: options.title || file.name.replace(/\.[^.]+$/, ''),
          propertyId: options.propertyId,
          // Reuse the same Bunny video on session retry so TUS can resume chunks
          existingVideoId: lastVideoId || undefined,
        })
        lastVideoId = auth.videoId

        const tusSession = runTusSession(file, auth, callbacks, options.signal)
        currentAbort = tusSession.abort
        await tusSession.done

        callbacks.onSuccess(auth.videoId)
        return auth.videoId
      } catch (err) {
        lastError = err
        if (aborted || (err instanceof Error && err.message === 'Upload cancelled')) {
          throw new Error('Upload cancelled')
        }

        const canSessionRetry =
          attempt < MAX_UPLOAD_SESSION_RETRIES &&
          (isAuthOrExpiredError(err) || isRetryableNetworkError(err))

        if (!canSessionRetry) {
          const msg =
            err instanceof Error ? err.message : 'Upload failed after multiple retries'
          callbacks.onError(msg)
          throw err instanceof Error ? err : new Error(msg)
        }
        // else loop → new signature / new session
      }
    }

    const msg =
      lastError instanceof Error
        ? lastError.message
        : 'Upload failed after multiple retries'
    callbacks.onError(msg)
    throw lastError instanceof Error ? lastError : new Error(msg)
  })()

  // videoId may not be known until first auth succeeds; expose placeholder then real id via done
  return {
    get videoId() {
      return lastVideoId
    },
    abort,
    done,
  }
}

/**
 * After TUS succeeds, register the video on a property (with retries).
 */
export async function completePropertyVideo(
  params: {
    videoId: string
    propertyId: string
    title?: string
    order?: number
  },
  retries = 3
) {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      const res = await videoApi.complete(params)
      return res.data.data as {
        id: string
        videoId: string
        url?: string | null
        thumbnailUrl?: string | null
        title?: string | null
        order: number
      }
    } catch (err) {
      lastErr = err
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
      }
    }
  }
  throw lastErr
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
