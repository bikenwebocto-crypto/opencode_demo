'use client'
// Thin wrapper around the generic `ImageUploader`. Preserves the
// original export names (`OfferImageUploader`, `PendingImage`) so
// `offer-form.tsx` and any other existing consumers require zero
// changes.
//
// Offer-banner defaults are baked in here:
//   - bucket:  offer-images
//   - types:   JPEG, PNG, SVG, WEBP, GIF
//   - max:     5 MB per file
//   - limit:   5 images

import { ImageUploader } from '@/components/shared/ImageUploader'
import type { ImageUploaderProps, PendingImage } from '@/components/shared/ImageUploader'
import { OFFER_IMAGE_OPTIONS } from '@/lib/upload/image'

// Re-export PendingImage so existing `import type { PendingImage } from
// './OfferImageUploader'` continues to work.
export type { PendingImage }

// The wrapper accepts the same props as before (subset of the generic
// component's props).
interface OfferImageUploaderProps {
  onImagesReady: (images: PendingImage[]) => void
  disabled?: boolean
  currentCount: number
}

export function OfferImageUploader({
  onImagesReady,
  disabled,
  currentCount,
}: OfferImageUploaderProps) {
  return (
    <ImageUploader
      onImagesReady={onImagesReady}
      disabled={disabled}
      currentCount={currentCount}
      uploadOptions={OFFER_IMAGE_OPTIONS}
      acceptedTypes={[
        'image/jpeg',
        'image/png',
        'image/svg+xml',
        'image/webp',
        'image/gif',
      ]}
      maxFileSize={5 * 1024 * 1024}
      maxFiles={5}
      placeholder="Drop images here or click to browse"
      allowMultiple
    />
  )
}
