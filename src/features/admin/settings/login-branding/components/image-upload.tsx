'use client'

import { ImageUploader, type DeferredFile } from '@/components/shared/ImageUploader'
import type { UploadImageOptions } from '@/lib/upload/image'

const BRANDING_UPLOAD_OPTIONS: UploadImageOptions = {
  bucket: 'offer-images',
  folder: 'Brand_banner',
}

interface BrandingImageUploadProps {
  label: string
  hint?: string
  value?: string | null
  onChange: (url: string | null) => void
  onDeferredFile?: (file: DeferredFile | null) => void
}

export function BrandingImageUpload({ label, hint, value, onChange, onDeferredFile }: BrandingImageUploadProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <ImageUploader
        uploadMode="deferred"
        uploadOptions={BRANDING_UPLOAD_OPTIONS}
        currentCount={value ? 1 : 0}
        maxFiles={2}
        allowMultiple={false}
        currentImageUrl={value ?? null}
        previewClassName="h-32 w-full rounded-md border object-cover"
        previewHint={hint}
        onFilesSelected={(files) => onDeferredFile?.(files[0] ?? null)}
      />
    </div>
  )
}
