'use client'
import { Gift, Clock, Tag, Star, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface OfferMobilePreviewProps {
  title: string
  shortDescription: string
  description: string
  discountValue: string
  offerType: string
  startDate: string
  endDate: string
  imageUrls: string[]
  isFeatured: boolean
  isExclusive: boolean
  merchantName?: string
  categoryName?: string
}

export function OfferMobilePreview({
  title,
  shortDescription,
  description,
  discountValue,
  offerType,
  startDate,
  endDate,
  imageUrls,
  isFeatured,
  isExclusive,
  merchantName,
  categoryName,
}: OfferMobilePreviewProps) {
  const bannerImage = imageUrls.length > 0 ? imageUrls[0] : ''

  const formatDate = (d: string) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return d
    }
  }

  const discountLabel = () => {
    const val = discountValue ? Number(discountValue) : 0
    if (!val) return ''
    return offerType === 'PERCENTAGE' ? `${val}% OFF` : offerType === 'BUY_X_GET_Y' ? `Buy X Get Y` : `$${val.toFixed(2)} OFF`
  }

  return (
    <div className="mx-auto max-w-[320px] overflow-hidden rounded-2xl border bg-card shadow-lg">
      {/* Banner image */}
      <div className="relative aspect-[2/1] bg-gradient-to-br from-primary/20 to-primary/5">
        {bannerImage ? (
          <img src={bannerImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gift className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {(isFeatured || isExclusive) && (
            <>
              {isFeatured && (
                <Badge variant="default" className="text-[10px]">
                  <Star className="mr-0.5 h-3 w-3" /> Featured
                </Badge>
              )}
              {isExclusive && (
                <Badge variant="secondary" className="text-[10px]">
                  <Sparkles className="mr-0.5 h-3 w-3" /> Exclusive
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Discount badge */}
        {discountLabel() && (
          <div className="absolute bottom-2 right-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground shadow">
            {discountLabel()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {/* Merchant name */}
        {merchantName && (
          <p className="text-xs font-medium text-muted-foreground">{merchantName}</p>
        )}

        {/* Title */}
        <h3 className="line-clamp-2 text-base font-semibold leading-tight">
          {title || 'Offer Title'}
        </h3>

        {/* Short description */}
        {(shortDescription || description) && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {shortDescription || description}
          </p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5">
          {offerType && (
            <Badge variant="outline" className="text-[10px]">
              <Tag className="mr-0.5 h-2.5 w-2.5" />
              {offerType === 'FLAT' ? 'Flat Amount' : offerType === 'PERCENTAGE' ? 'Percentage' : 'Buy X Get Y'}
            </Badge>
          )}
          {categoryName && (
            <Badge variant="secondary" className="text-[10px]">{categoryName}</Badge>
          )}
        </div>

        {/* Validity */}
        {(startDate || endDate) && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(startDate)} — {formatDate(endDate)}</span>
          </div>
        )}

        {/* Mock redeem button */}
        <button
          type="button"
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-sm"
        >
          {discountLabel() ? `Redeem ${discountLabel()}` : 'View Offer'}
        </button>
      </div>

      {/* Empty state hint */}
      {!title && !discountValue && !bannerImage && (
        <div className="px-4 pb-4 text-center text-[10px] text-muted-foreground">
          Start typing on the left to see a live preview
        </div>
      )}
    </div>
  )
}
