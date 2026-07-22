'use client'
import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface AnalyticsKPICardProps {
  label: string
  value: number | string
  sublabel?: string
  icon?: React.ElementType
  iconBg?: string
  iconColor?: string
  accentColor?: string
  loading?: boolean
  trend?: { value: number; isUpward: boolean }
}

export function AnalyticsKPICard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconBg = 'bg-blue-100 text-blue-600',
  iconColor,
  accentColor = 'from-blue-500 to-indigo-600',
  loading,
  trend,
}: AnalyticsKPICardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-sm">
        <div className="p-3">
          <Skeleton className="mb-1 h-3 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accentColor}`} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="truncate text-xl font-bold tabular-nums">{value}</p>
            {sublabel && (
              <p className="truncate text-[9px] text-muted-foreground">{sublabel}</p>
            )}
          </div>
          {Icon && (
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor ?? ''}`} />
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px]">
            <span className={trend.isUpward ? 'text-emerald-600' : 'text-rose-600'}>
              {trend.isUpward ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs previous</span>
          </div>
        )}
      </div>
    </Card>
  )
}
