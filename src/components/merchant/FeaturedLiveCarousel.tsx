'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { ChevronLeft, ChevronRight, Gift, ShoppingBag, Eye, CalendarDays, Plus } from 'lucide-react'

interface LiveOffer {
  id: string
  title: string
  offerType: string
  endDate: string
  pricing?: { configuration?: Record<string, unknown> }
  redemption?: { currentRedemptions?: number; maxRedemptions?: number }
  views?: number
  bannerGradient?: string
}

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
]

function formatOfferValue(offer: LiveOffer): string {
  const cfg = (offer.pricing?.configuration as Record<string, unknown>) ?? {}
  const offerType = offer.offerType
  if (offerType === 'percentage' || offerType === 'PERCENTAGE') {
    return `${Number(cfg.percent ?? cfg.amount ?? 0)}% OFF`
  }
  if (offerType === 'buy_x_get_y' || offerType === 'BUY_X_GET_Y') {
    return 'Buy X Get Y'
  }
  const amount = Number(cfg.amount ?? 0)
  return `£${amount.toFixed(2)} OFF`
}

function formatExpiry(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CarouselSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex h-[280px]">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    </Card>
  )
}

function EmptyCarousel() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Gift className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <h3 className="mt-4 text-base font-medium">No live offers yet</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Create your first campaign to start reaching employees and tracking performance
        </p>
        <Link href="/merchant/offers/create">
          <Button className="mt-6 gap-1.5">
            <Plus className="h-4 w-4" /> Create Your First Offer
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

interface FeaturedLiveCarouselProps {
  offers: LiveOffer[]
  isLoading?: boolean
}

export function FeaturedLiveCarousel({ offers, isLoading }: FeaturedLiveCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const total = offers.length

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, total - 1)))
  }, [total])

  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])
  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])

  useEffect(() => {
    if (isPaused || total <= 1) return
    intervalRef.current = setInterval(goNext, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPaused, goNext, total])

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? 0 }
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0]?.clientX ?? 0
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev()
    }
  }

  if (isLoading) return <CarouselSkeleton />
  if (total === 0) return <EmptyCarousel />

  const offer = offers[currentIndex]!
  const grad = offer.bannerGradient ?? GRADIENTS[currentIndex % GRADIENTS.length]

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Link href={`/merchant/offers/${offer.id}`}>
        <div className={cn('relative flex h-[260px] sm:h-[300px] bg-gradient-to-br p-6 sm:p-8 text-white', grad)}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
          <div className="relative flex w-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Badge variant="live" className="uppercase text-[10px] tracking-wider shadow-sm">
                  <ShoppingBag className="mr-1 h-3 w-3" /> Featured Offer
                </Badge>
                <h3 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">{offer.title}</h3>
                <p className="text-sm text-white/80">{formatOfferValue(offer)}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                View Details
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4" />
                {offer.redemption?.currentRedemptions ?? 0} redemptions
              </span>
              {offer.views !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {offer.views} views
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Expires {formatExpiry(offer.endDate)}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {total > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
            aria-label="Previous offer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
            aria-label="Next offer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {offers.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === currentIndex ? 'h-2 w-6 bg-white' : 'h-2 w-2 bg-white/50 hover:bg-white/70',
                )}
                aria-label={`Go to offer ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
