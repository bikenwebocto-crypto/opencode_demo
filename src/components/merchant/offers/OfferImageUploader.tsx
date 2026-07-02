'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, AlertCircle, Loader2 } from 'lucide-react'
import { uploadOfferImage } from '@/lib/upload-offer-image'
import { showToast } from '@/hooks/use-toast'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024
const MAX_FILES = 5

export interface PendingImage {
  id: string
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  url?: string
  error?: string
}

interface OfferImageUploaderProps {
  onImagesReady: (images: PendingImage[]) => void
  disabled?: boolean
  currentCount: number
}

export function OfferImageUploader({ onImagesReady, disabled, currentCount }: OfferImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFiles = useCallback((files: FileList | File[]): File[] => {
    const valid: File[] = []
    const remaining = MAX_FILES - currentCount

    for (const file of Array.from(files)) {
      if (valid.length >= remaining) {
        showToast({ type: 'error', title: `Maximum ${MAX_FILES} images allowed` })
        break
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        showToast({ type: 'error', title: `Unsupported file type: ${file.type}` })
        continue
      }
      if (file.size > MAX_SIZE) {
        showToast({ type: 'error', title: `${file.name} exceeds 5 MB limit` })
        continue
      }
      valid.push(file)
    }
    return valid
  }, [currentCount])

  const processFiles = async (files: FileList | File[]) => {
    const valid = validateFiles(files)
    if (valid.length === 0) return

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
        const url = await uploadOfferImage(item.file)
        item.status = 'done'
        item.url = url
      } catch (err: any) {
        item.status = 'error'
        item.error = err.message || 'Upload failed'
      }
      results.push({ ...item })
    }

    setUploading(false)
    onImagesReady(results)
  }

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

  const remaining = MAX_FILES - currentCount

  return (
    <div>
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
          {uploading ? 'Uploading...' : 'Drop images here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PNG, JPG, SVG, WEBP, GIF &middot; Up to 5 MB each &middot; Max {MAX_FILES} images
        </p>
        {remaining < MAX_FILES && (
          <p className="mt-1 text-xs text-muted-foreground">{remaining} of {MAX_FILES} remaining</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
      </div>
    </div>
  )
}
