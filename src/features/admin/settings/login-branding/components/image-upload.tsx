'use client'

import { ImageUploader } from '@/components/shared/ImageUploader'
import type { UploadImageOptions } from '@/lib/upload/image'

const BRANDING_UPLOAD_OPTIONS: UploadImageOptions = {
  bucket: 'offer-images',
  folder: 'branding',
}

interface BrandingImageUploadProps {
  label: string
  hint?: string
  value?: string | null
  onChange: (url: string | null) => void
}

export function BrandingImageUpload({ label, hint, value, onChange }: BrandingImageUploadProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <ImageUploader
        uploadMode="immediate"
        uploadOptions={BRANDING_UPLOAD_OPTIONS}
        currentCount={value ? 1 : 0}
        maxFiles={1}
        allowMultiple={false}
        currentImageUrl={value ?? null}
        previewClassName="h-32 w-full rounded-md border object-cover"
        previewHint={hint}
        onImagesReady={(images) => {
          const done = images.find((i) => i.status === 'done')
          if (done?.url) onChange(done.url)
        }}
      />
    </div>
  )
}
