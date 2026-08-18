'use client'

import { useRef, useState, useCallback } from 'react'
import {
  Video,
  Upload,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Film,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { videoApi } from '@/lib/api'
import {
  PendingVideo,
  validateVideoFile,
  checkVideoMagicBytes,
  startVideoTusUpload,
  completePropertyVideo,
  formatBytes,
  MAX_VIDEO_BYTES,
  MAX_UPLOAD_SESSION_RETRIES,
} from '@/lib/tusUpload'

const MAX_VIDEOS = 3

interface VideoUploaderProps {
  propertyId?: string
  videos: PendingVideo[]
  onChange: (videos: PendingVideo[] | ((prev: PendingVideo[]) => PendingVideo[])) => void
  disabled?: boolean
}

function uid() {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function VideoUploader({
  propertyId,
  videos,
  onChange,
  disabled,
}: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const abortMap = useRef<Map<string, () => void>>(new Map())
  /** Keep File objects so Retry does not require re-selecting the file */
  const fileMap = useRef<Map<string, File>>(new Map())
  const [dragOver, setDragOver] = useState(false)

  const patchVideo = useCallback(
    (localId: string, patch: Partial<PendingVideo>) => {
      onChange((prev) =>
        prev.map((v) => (v.localId === localId ? { ...v, ...patch } : v))
      )
    },
    [onChange]
  )

  const removeVideo = useCallback(
    async (localId: string) => {
      const target = videos.find((v) => v.localId === localId)
      abortMap.current.get(localId)?.()
      abortMap.current.delete(localId)
      fileMap.current.delete(localId)

      if (target?.dbId) {
        try {
          await videoApi.delete(target.dbId)
        } catch (e) {
          console.error('Failed to delete video', e)
        }
      }

      onChange((prev) => prev.filter((v) => v.localId !== localId))
    },
    [videos, onChange]
  )

  const runUpload = useCallback(
    async (file: File, localId: string, order: number) => {
      fileMap.current.set(localId, file)
      patchVideo(localId, {
        status: 'authorizing',
        progress: 0,
        error: undefined,
        retryAttempt: 0,
      })

      try {
        const handle = await startVideoTusUpload(
          file,
          {
            title: file.name.replace(/\.[^.]+$/, ''),
            propertyId,
          },
          {
            onProgress(percent, bytesUploaded) {
              patchVideo(localId, {
                status: 'uploading',
                progress: percent,
                bytesUploaded,
                error: undefined,
              })
            },
            onSuccess() {},
            onError(message) {
              // Keep last progress so user sees how far it got before failure
              patchVideo(localId, {
                status: 'error',
                error: message,
              })
            },
            onChunkRetry(retryAttempt) {
              patchVideo(localId, {
                status: 'retrying',
                retryAttempt,
              })
            },
            onSessionRetry(sessionAttempt, reason) {
              patchVideo(localId, {
                status: 'retrying',
                retryAttempt: sessionAttempt,
                error: `Reconnecting… (${sessionAttempt}/${MAX_UPLOAD_SESSION_RETRIES}) ${reason}`,
              })
            },
          }
        )

        abortMap.current.set(localId, handle.abort)

        // videoId may become available after first auth
        const waitForId = async () => {
          // Poll lightly until done resolves or videoId is set
          for (let i = 0; i < 50; i++) {
            if (handle.videoId) {
              patchVideo(localId, { videoId: handle.videoId })
              break
            }
            await new Promise((r) => setTimeout(r, 100))
          }
        }
        void waitForId()

        const videoId = await handle.done

        patchVideo(localId, {
          videoId,
          status: propertyId ? 'completing' : 'success',
          progress: 100,
          error: undefined,
          retryAttempt: 0,
        })

        if (propertyId) {
          try {
            const registered = await completePropertyVideo({
              videoId,
              propertyId,
              title: file.name.replace(/\.[^.]+$/, ''),
              order,
            })
            patchVideo(localId, {
              status: 'success',
              progress: 100,
              videoId,
              dbId: registered.id,
              url: registered.url,
              thumbnailUrl: registered.thumbnailUrl,
              title: registered.title || file.name,
              existing: true,
              error: undefined,
            })
          } catch (e: any) {
            patchVideo(localId, {
              status: 'error',
              error:
                e?.response?.data?.error ||
                e?.message ||
                'Upload finished but registration failed. Tap Retry.',
              videoId,
            })
          }
        }
      } catch (e: any) {
        if (e?.message === 'Upload cancelled') return
        patchVideo(localId, {
          status: 'error',
          error: e?.response?.data?.error || e?.message || 'Upload failed',
        })
      } finally {
        abortMap.current.delete(localId)
      }
    },
    [propertyId, patchVideo]
  )

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const currentCount = videos.length
      const remaining = MAX_VIDEOS - currentCount
      if (remaining <= 0) return

      const files = Array.from(fileList).slice(0, remaining)
      const toStart: { file: File; localId: string; order: number }[] = []
      const additions: PendingVideo[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const localId = uid()
        const order = currentCount + i

        const basicErr = validateVideoFile(file)
        if (basicErr) {
          additions.push({
            localId,
            fileName: file.name,
            fileSize: file.size,
            order,
            status: 'error',
            progress: 0,
            error: basicErr,
          })
          continue
        }

        const magicErr = await checkVideoMagicBytes(file)
        if (magicErr) {
          additions.push({
            localId,
            fileName: file.name,
            fileSize: file.size,
            order,
            status: 'error',
            progress: 0,
            error: magicErr,
          })
          continue
        }

        fileMap.current.set(localId, file)
        additions.push({
          localId,
          fileName: file.name,
          fileSize: file.size,
          order,
          status: 'authorizing',
          progress: 0,
          title: file.name.replace(/\.[^.]+$/, ''),
        })
        toStart.push({ file, localId, order })
      }

      if (additions.length) {
        onChange((prev) => [...prev, ...additions])
      }

      for (const item of toStart) {
        void runUpload(item.file, item.localId, item.order)
      }

      if (inputRef.current) inputRef.current.value = ''
    },
    [videos.length, onChange, runUpload]
  )

  /**
   * Retry without re-selecting the file when we still hold the File reference.
   * TUS fingerprint allows resume from the last successful chunk when possible.
   */
  const retryUpload = useCallback(
    (localId: string) => {
      const file = fileMap.current.get(localId)
      const entry = videos.find((v) => v.localId === localId)
      if (!file || !entry) {
        // File was lost (page refresh) — ask user to pick again
        void removeVideo(localId)
        setTimeout(() => inputRef.current?.click(), 100)
        return
      }

      // If TUS finished but complete() failed, only re-register
      if (entry.videoId && entry.progress >= 100 && propertyId && !entry.dbId) {
        patchVideo(localId, { status: 'completing', error: undefined })
        void completePropertyVideo({
          videoId: entry.videoId,
          propertyId,
          title: entry.title || entry.fileName,
          order: entry.order,
        })
          .then((registered) => {
            patchVideo(localId, {
              status: 'success',
              dbId: registered.id,
              url: registered.url,
              thumbnailUrl: registered.thumbnailUrl,
              existing: true,
              error: undefined,
            })
          })
          .catch((e: any) => {
            patchVideo(localId, {
              status: 'error',
              error: e?.response?.data?.error || e?.message || 'Registration failed',
            })
          })
        return
      }

      void runUpload(file, localId, entry.order)
    },
    [videos, propertyId, patchVideo, removeVideo, runUpload]
  )

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
      <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
        <Film className="w-5 h-5 text-orange-500" />
        Property Videos
      </h2>
      <p className="text-slate-400 text-xs mb-4">
        Upload walkthrough videos (MP4, MOV, WebM · max{' '}
        {Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB each). Chunked resumable upload with
        automatic retries — the browser stays responsive on slow connections.
      </p>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          <span
            className={cn(
              'font-bold text-sm',
              videos.length >= MAX_VIDEOS
                ? 'text-orange-500'
                : 'text-slate-700 dark:text-slate-200'
            )}
          >
            {videos.length}
          </span>
          {' '}
          / {MAX_VIDEOS} videos
        </p>
        {videos.length >= MAX_VIDEOS && (
          <span className="text-xs font-medium text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-lg">
            Maximum reached
          </span>
        )}
      </div>

      {videos.length > 0 && (
        <ul className="space-y-3 mb-4">
          {videos.map((v) => (
            <li
              key={v.localId}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Video className="w-5 h-5 text-slate-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {v.title || v.fileName}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeVideo(v.localId)}
                    disabled={disabled}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {v.fileSize > 0 ? formatBytes(v.fileSize) : 'Existing video'}
                  {v.bytesUploaded != null &&
                    v.bytesUploaded > 0 &&
                    v.status !== 'success' && (
                      <span className="ml-2">
                        · {formatBytes(v.bytesUploaded)} sent
                      </span>
                    )}
                  {v.videoId && (
                    <span className="ml-2 font-mono text-[10px] opacity-70">
                      {v.videoId.slice(0, 8)}…
                    </span>
                  )}
                </p>

                {(v.status === 'authorizing' ||
                  v.status === 'uploading' ||
                  v.status === 'retrying' ||
                  v.status === 'completing') && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {v.status === 'authorizing' && 'Preparing upload…'}
                        {v.status === 'uploading' && `Uploading ${v.progress}%`}
                        {v.status === 'retrying' &&
                          `Retrying chunk${v.retryAttempt ? ` (attempt ${v.retryAttempt})` : ''}…`}
                        {v.status === 'completing' && 'Registering video…'}
                      </span>
                      {(v.status === 'uploading' || v.status === 'retrying') && (
                        <span>{v.progress}%</span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-300 ease-out rounded-full',
                          v.status === 'retrying' ? 'bg-amber-500' : 'bg-orange-500'
                        )}
                        style={{
                          width: `${
                            v.status === 'authorizing'
                              ? 5
                              : v.status === 'completing'
                                ? 100
                                : Math.max(v.progress, 2)
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {v.status === 'success' && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {propertyId || v.existing
                      ? 'Uploaded & registered'
                      : 'Uploaded — will attach when you save the property'}
                  </p>
                )}

                {v.status === 'error' && (
                  <div className="mt-1.5 flex items-start gap-2">
                    <p className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400 flex-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        {v.error || 'Upload failed'}
                        {v.progress > 0 && v.progress < 100 && (
                          <span className="block text-slate-500 dark:text-slate-400 mt-0.5">
                            Stopped at {v.progress}% — retry will resume from the last chunk when possible.
                          </span>
                        )}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => retryUpload(v.localId)}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-500 shrink-0 font-medium"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {videos.length < MAX_VIDEOS && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (!disabled && e.dataTransfer.files?.length) {
              void handleFiles(e.dataTransfer.files)
            }
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all',
            dragOver
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-slate-50 dark:hover:bg-slate-800/40',
            disabled && 'opacity-60 pointer-events-none'
          )}
        >
          <Upload className="w-6 h-6 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Click or drag videos here
          </p>
          <p className="text-xs text-slate-400">
            MP4 · MOV · WebM · up to {Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB · chunked + auto-retry
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        multiple
        className="hidden"
        disabled={disabled || videos.length >= MAX_VIDEOS}
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
        }}
      />
    </div>
  )
}

export function mapExistingVideos(
  apiVideos: Array<{
    id: string
    videoId: string
    url?: string | null
    thumbnailUrl?: string | null
    title?: string | null
    order?: number
    size?: number | null
  }>
): PendingVideo[] {
  return (apiVideos || []).map((v, i) => ({
    localId: `existing_${v.id}`,
    dbId: v.id,
    videoId: v.videoId,
    fileName: v.title || `Video ${i + 1}`,
    fileSize: v.size ? Number(v.size) : 0,
    title: v.title || undefined,
    url: v.url,
    thumbnailUrl: v.thumbnailUrl,
    order: v.order ?? i,
    status: 'success' as const,
    progress: 100,
    existing: true,
  }))
}

export function hasActiveVideoUpload(videos: PendingVideo[]): boolean {
  return videos.some(
    (v) =>
      v.status === 'authorizing' ||
      v.status === 'uploading' ||
      v.status === 'retrying' ||
      v.status === 'completing'
  )
}
