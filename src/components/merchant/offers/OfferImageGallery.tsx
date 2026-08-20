'use client'
// Thin wrapper around the generic `ImageGallery`. Preserves the
// original export name (`OfferImageGallery`) so existing consumers
// require zero changes.
//
// Offer-banner gallery defaults:
//   - aspect ratio: 2:1 (landscape banners)
//   - primary badge: shown
//   - reorder buttons: shown

import { ImageGallery } from '@/components/shared/ImageGallery'
import type { ImageGalleryProps } from '@/components/shared/ImageGallery'
import type { PendingImage } from '@/components/shared/ImageUploader'

// Re-export PendingImage for any consumer that imports it from this
// file (the gallery component originally imported it from
// './OfferImageUploader').
export type { PendingImage }

interface OfferImageGalleryProps {
  images: PendingImage[]
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function OfferImageGallery({
  images,
  onRemove,
  onMoveUp,
  onMoveDown,
}: OfferImageGalleryProps) {
  return (
    <ImageGallery
      images={images}
      onRemove={onRemove}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      aspectRatio="aspect-[2/1]"
      showPrimaryBadge
      showReorder
    />
  )
}
