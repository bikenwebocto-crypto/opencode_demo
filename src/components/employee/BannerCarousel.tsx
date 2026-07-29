'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
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

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)

  if (banners.length === 0) return null

  const current = banners[index]!

  const prev = () => setIndex((i) => (i === 0 ? banners.length - 1 : i - 1))
  const next = () => setIndex((i) => (i === banners.length - 1 ? 0 : i + 1))

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sponsored
        </span>
      </div>

      <div className="relative">
        {banners.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-3 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-background/80 shadow-sm hover:bg-background"
              onClick={prev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-background/80 shadow-sm hover:bg-background"
              onClick={next}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        <Link
          href={current.redirect_url ?? '#'}
          target={current.redirect_url ? '_blank' : undefined}
        >
          <Card className="overflow-hidden transition-shadow hover:shadow-md">
            <div className="relative h-56 w-full bg-muted sm:h-44">
              <img
                src={current.image_url}
                alt={current.alt_text ?? current.business_name}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="truncate text-sm font-medium text-white">
                  {current.business_name}
                </p>
              </div>
            </div>
          </Card>
        </Link>

        {banners.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
