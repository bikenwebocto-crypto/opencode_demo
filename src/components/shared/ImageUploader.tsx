'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { showToast } from '@/hooks/use-toast'
import type { UploadImageOptions } from '@/lib/upload/image'
import { uploadImage } from '@/lib/upload/image'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingImage {
  id: string
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  url?: string
  error?: string
}

export interface ImageUploaderProps {
  /** Called once with pending items, then again with final results. */
  onImagesReady: (images: PendingImage[]) => void
  /** Disables the entire drop zone. */
  disabled?: boolean
  /** Number of images already uploaded (used to compute remaining slots). */
  currentCount: number
  /** Upload target — bucket, folder, etc. */
  uploadOptions: UploadImageOptions
  /** Accepted MIME types. Defaults to the standard image set. */
  acceptedTypes?: string[]
  /** Maximum file size in bytes. Defaults to 5 MB. */
  maxFileSize?: number
  /** Maximum total files. Defaults to 5. */
  maxFiles?: number
  /** Placeholder text shown inside the drop zone. */
  placeholder?: string
  /** Accepted MIME type string for the <input accept> attribute. */
  accept?: string
  /** Allow multiple file selection. Defaults to true. */
  allowMultiple?: boolean
  /** Whether to show the remaining-slots hint. Defaults to true. */
  showRemaining?: boolean
  /** URL of an existing image to show as preview (e.g. from database). */
  currentImageUrl?: string | null
  /** CSS class applied to the preview <img> element. */
  previewClassName?: string
  /** Text shown below the preview image. */
  previewHint?: string
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
  'image/gif',
]
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const DEFAULT_MAX_FILES = 5

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageUploader({
  onImagesReady,
  disabled = false,
  currentCount,
  uploadOptions,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = DEFAULT_MAX_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  placeholder = 'Drop images here or click to browse',
  accept,
  allowMultiple = true,
  showRemaining = true,
  currentImageUrl = null,
  previewClassName,
  previewHint,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptAttr = accept ?? acceptedTypes.join(',')
  const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024))
  const typeSummary = acceptedTypes
    .map((t) => t.split('/')[1]?.toUpperCase() ?? t)
    .join(', ')

  // The preview URL to show — either the newly uploaded URL or the existing one
  const previewUrl = lastUploadedUrl ?? currentImageUrl

  // ---- Validation --------------------------------------------------------

  const validateFiles = useCallback(
    (files: FileList | File[]): File[] => {
      const valid: File[] = []
      const remaining = maxFiles - currentCount

      for (const file of Array.from(files)) {
        if (valid.length >= remaining) {
          showToast({ type: 'error', title: `Maximum ${maxFiles} images allowed` })
          break
        }
        if (!acceptedTypes.includes(file.type)) {
          showToast({ type: 'error', title: `Unsupported file type: ${file.type}` })
          continue
        }
        if (file.size > maxFileSize) {
          showToast({ type: 'error', title: `${file.name} exceeds ${maxFileSizeMB} MB limit` })
          continue
        }
        if (file.size === 0) {
          showToast({ type: 'error', title: `${file.name} is empty` })
          continue
        }
        valid.push(file)
      }
      return valid
    },
    [currentCount, maxFiles, acceptedTypes, maxFileSize, maxFileSizeMB],
  )

  // ---- Upload ------------------------------------------------------------

  const processFiles = async (files: FileList | File[]) => {
    const valid = validateFiles(files)
    if (valid.length === 0) return

    // Clear previous states
    setUploadError(null)
    setUploadSuccess(false)

    console.log('[ImageUploader] Processing files:', valid.map((f) => f.name))
    const pending: PendingImage[] = valid.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
    }))

    onImagesReady(pending)

    setUploading(true)
    const results: PendingImage[] = []

    for (const item of pending) {
      item.status = 'uploading'
      try {
        const url = await uploadImage(item.file, uploadOptions)
        item.status = 'done'
        item.url = url
        setLastUploadedUrl(url)
        setUploadSuccess(true)
        setUploadError(null)
      } catch (err: any) {
        item.status = 'error'
        item.error = err.message || 'Upload failed'
        setUploadError(err.message || 'Upload failed')
        setUploadSuccess(false)
        console.error('[ImageUploader] Upload error:', err)
      }
      results.push({ ...item })
    }

    setUploading(false)
    onImagesReady(results)
  }

  // ---- Event handlers ----------------------------------------------------

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    processFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleClick = () => inputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }

  // ---- Render ------------------------------------------------------------

  const remaining = maxFiles - currentCount
  const hasPreview = !!previewUrl

  return (
    <div className="space-y-3">
      {/* Existing image preview */}
      {hasPreview && (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Current image"
            className={previewClassName ?? 'h-20 w-20 rounded-md border object-cover'}
          />
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled || uploading}
            className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity hover:opacity-100 disabled:opacity-0"
            title="Replace image"
          >
            <RefreshCw className="h-5 w-5 text-white" />
          </button>
          {previewHint && (
            <p className="mt-1 text-xs text-muted-foreground">{previewHint}</p>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
          transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${disabled || uploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        {uploading ? (
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {uploading ? 'Uploading...' : hasPreview ? 'Drop to replace' : placeholder}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {typeSummary} &middot; Up to {maxFileSizeMB} MB each
          {allowMultiple ? ` \u00b7 Max ${maxFiles} images` : ''}
        </p>
        {showRemaining && allowMultiple && remaining < maxFiles && (
          <p className="mt-1 text-xs text-muted-foreground">{remaining} of {maxFiles} remaining</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={allowMultiple}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
      </div>

      {/* Upload success message */}
      {uploadSuccess && !uploading && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Upload successful</span>
        </div>
      )}

      {/* Upload error message */}
      {uploadError && !uploading && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Upload failed</p>
            <p className="text-xs">{uploadError}</p>
          </div>
        </div>
      )}
    </div>
  )
}
