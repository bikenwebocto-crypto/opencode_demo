'use client'

import { useState } from 'react'
import { ImageUploader } from '@/components/shared/ImageUploader'
import { Button } from '@/components/ui/button'
import { X, AlertCircle } from 'lucide-react'
import type { UploadImageOptions } from '@/lib/upload/image'
import { BANNER_IMAGE_OPTIONS } from '@/lib/upload/image'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  onBlur?: () => void
  error?: string
  label?: string
  helperText?: string
  disabled?: boolean
  uploadOptions?: UploadImageOptions
  minWidth?: number
  minHeight?: number
  aspectRatio?: number
}

export function ImageUpload({
  value,
  onChange,
  onBlur,
  error,
  label = 'Image',
  helperText,
  disabled = false,
  uploadOptions = BANNER_IMAGE_OPTIONS,
  minWidth,
  minHeight,
  aspectRatio,
}: ImageUploadProps) {
  const [internalUrl, setInternalUrl] = useState(value)

  const currentUrl = value || internalUrl

  function handleImagesReady(images: { status: string; url?: string }[]) {
    const done = images.find((i) => i.status === 'done')
    if (done?.url) {
      setInternalUrl(done.url)
      onChange(done.url)
    }
  }

  function handleClear() {
    setInternalUrl('')
    onChange('')
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      )}
      {helperText && (
        <p className="mb-2 text-xs text-muted-foreground">{helperText}</p>
      )}

      {currentUrl ? (
        <div className="relative inline-block w-full">
          <img
            src={currentUrl}
            alt="Uploaded banner"
            className="h-auto max-h-48 w-full rounded-lg border object-contain"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <ImageUploader
          uploadMode="immediate"
          uploadOptions={uploadOptions}
          currentCount={0}
          maxFiles={1}
          allowMultiple={false}
          showRemaining={false}
          disabled={disabled}
          minWidth={minWidth}
          minHeight={minHeight}
          aspectRatio={aspectRatio}
          onImagesReady={handleImagesReady}
        />
      )}

      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
