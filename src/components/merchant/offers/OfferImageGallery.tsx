'use client'
import { X, Star, ChevronUp, ChevronDown, AlertCircle, Loader2 } from 'lucide-react'
import type { PendingImage } from './OfferImageUploader'

interface OfferImageGalleryProps {
  images: PendingImage[]
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function OfferImageGallery({ images, onRemove, onMoveUp, onMoveDown }: OfferImageGalleryProps) {
  if (images.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {images.map((img, index) => {
        const displayUrl = img.url || img.previewUrl
        const isPrimary = index === 0

        return (
          <div
            key={img.id}
            className="group relative overflow-hidden rounded-lg border bg-background"
          >
            <div className="aspect-[2/1] overflow-hidden bg-muted">
              <img
                src={displayUrl}
                alt={img.file.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ''
                }}
              />
            </div>

            {isPrimary && (
              <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                <Star className="h-3 w-3" />
                Primary
              </div>
            )}

            {img.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {img.status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Failed
                </div>
              </div>
            )}

            <div className="space-y-1 p-2">
              <p className="truncate text-xs font-medium">{img.file.name}</p>
              <p className="text-[10px] text-muted-foreground">{(img.file.size / 1024).toFixed(0)} KB</p>
            </div>

            <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => onMoveUp(img.id)}
                  className="flex h-5 w-5 items-center justify-center rounded bg-background/80 text-muted-foreground hover:bg-background"
                  title="Move left"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
              {index < images.length - 1 && (
                <button
                  type="button"
                  onClick={() => onMoveDown(img.id)}
                  className="flex h-5 w-5 items-center justify-center rounded bg-background/80 text-muted-foreground hover:bg-background"
                  title="Move right"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
