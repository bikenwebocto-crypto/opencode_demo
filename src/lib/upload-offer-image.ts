// Offer image upload / delete — thin wrapper over the generic
// `src/lib/upload/image.ts` utility. Preserves the original export
// signatures so existing consumers (`offer-form.tsx`, etc.) require
// zero changes.

import {
  uploadImage,
  deleteImage,
  OFFER_IMAGE_OPTIONS,
} from '@/lib/upload/image'

export async function uploadOfferImage(file: File): Promise<string> {
  return uploadImage(file, OFFER_IMAGE_OPTIONS)
}

export async function deleteOfferImage(url: string): Promise<void> {
  return deleteImage(url, { bucket: OFFER_IMAGE_OPTIONS.bucket })
}
