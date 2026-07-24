'use client'

import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Banner {
  id: string
  image_url: string
  alt_text: string | null
  redirect_url: string | null
  business_name: string
  banner_name: string
  position: string
}

export function BannerCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employee-banners'],
    queryFn: async () => {
      const res = await fetch('/api/employee/banners')
      const json = await res.json()
      if (!res.ok) return { data: [] as Banner[] }
      return json as { success: boolean; data: Banner[] }
    },
    staleTime: 1000 * 60 * 5,
  })

  const banners = data?.data ?? []

  if (!isLoading && banners.length === 0) return null

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 320
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sponsored
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (
        <div className="group relative">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-none pb-1"
          >
            {banners.map((banner) => (
              <Link
                key={banner.id}
                href={banner.redirect_url ?? '#'}
                target={banner.redirect_url ? '_blank' : undefined}
                className="shrink-0"
              >
                <Card className="w-[280px] overflow-hidden transition-shadow hover:shadow-md">
                  <div className="relative h-28 w-full bg-muted">
                    <img
                      src={banner.image_url}
                      alt={banner.alt_text ?? banner.business_name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="truncate text-xs font-medium text-white">
                        {banner.business_name}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {banners.length > 2 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-background/80 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background group-hover:flex"
                onClick={() => scroll('left')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-background/80 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background group-hover:flex"
                onClick={() => scroll('right')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
