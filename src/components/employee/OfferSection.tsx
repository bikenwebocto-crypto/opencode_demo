'use client'

import { type EmployeeOffer } from '@/components/employee/offers/employee-offer'
import { OfferCard } from '@/components/employee/OfferCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'

const ACCENTS = [
  { from: 'from-orange-50/70', border: 'border-orange-100', dot: '#f97316' },
  { from: 'from-blue-50/70', border: 'border-blue-100', dot: '#3b82f6' },
  { from: 'from-emerald-50/70', border: 'border-emerald-100', dot: '#10b981' },
  { from: 'from-purple-50/70', border: 'border-purple-100', dot: '#a855f7' },
  { from: 'from-pink-50/70', border: 'border-pink-100', dot: '#ec4899' },
  { from: 'from-amber-50/70', border: 'border-amber-100', dot: '#f59e0b' },
  { from: 'from-indigo-50/70', border: 'border-indigo-100', dot: '#6366f1' },
  { from: 'from-teal-50/70', border: 'border-teal-100', dot: '#14b8a6' },
  { from: 'from-rose-50/70', border: 'border-rose-100', dot: '#f43f5e' },
  { from: 'from-cyan-50/70', border: 'border-cyan-100', dot: '#06b6d4' },
]

function pickAccent(id: string, index: number): (typeof ACCENTS)[number] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return ACCENTS[(hash + index) % ACCENTS.length]!
}

interface OfferSectionProps {
  title: string
  subtitle?: string
  icon?: string | null
  offers: EmployeeOffer[]
  onViewAll?: () => void
  onSelectOffer: (id: string) => void
}

export function OfferSection({
  title,
  subtitle,
  icon,
  offers,
  onViewAll,
  onSelectOffer,
}: OfferSectionProps) {
  const accent = pickAccent(title, 0)
  const dotBg = { backgroundImage: `radial-gradient(circle, ${accent.dot} 0.5px, transparent 0.5px)`, backgroundSize: '20px 20px' }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.from} to-white p-5 sm:p-6`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={dotBg}
      />
      <div className="relative mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="flex-shrink-0 text-xl" role="img" aria-hidden>
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {onViewAll && offers.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="flex-shrink-0 gap-1 text-xs transition-colors hover:gap-1.5"
          >
            View All <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </div>

      {offers.length === 0 ? (
        <Card className="border-dashed bg-white/50">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No offers available.
          </CardContent>
        </Card>
      ) : (
        <div className="relative grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onOpen={(o) => onSelectOffer(o.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
