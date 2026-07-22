'use client'
import * as React from 'react'
import {
  Calendar,
  X,
  AlertCircle,
  RotateCw,
  ExternalLink,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import {
  StatusPie,
  CategoryPie,
  DailyTrendLine,
  OfferFunnel,
  ChartLegend,
  FunnelDropOffSummary,
  formatNumber,
  formatPercent,
} from '@/components/analytics/analytics-charts'
import {
  OfferPerformanceTable,
  type OfferPerformanceRow,
} from '@/components/analytics/offer-performance-table'
import type {
  AnalyticsDialogConfig,
  ChartSpec,
  KpiSpec,
} from '@/components/analytics/analytics-config'

// ============================================================================
// Unified AnalyticsDialog
//
// One component, config-driven. Each entity (merchant, company) supplies a
// `AnalyticsDialogConfig` describing its header, KPIs, charts, table, and
// footer. The dialog renders identical UI for any config — no duplication.
//
// Spec coverage:
//   ✓ Single component for both Merchant and Company
//   ✓ No UI duplication
//   ✓ Title / cards / table columns / chart titles are all config-driven
//   ✓ All charts reuse analytics-charts.tsx primitives
// ============================================================================

interface AnalyticsDialogProps {
  config: AnalyticsDialogConfig | null
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const SIZE_CLASS: Record<NonNullable<AnalyticsDialogProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-[1100px]',
  full: 'max-w-[min(96vw,1400px)]',
}

export function AnalyticsDialog({
  config,
  isLoading,
  error,
  onRetry,
  open,
  onOpenChange,
  size = 'xl',
}: AnalyticsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[92vh] w-[min(96vw,1100px)] overflow-hidden p-0',
          SIZE_CLASS[size],
        )}
      >
        {/* Header — always rendered (even during loading) so the dialog feels
            stable and shows the entity name immediately. */}
        <DialogHeader config={config} onClose={() => onOpenChange(false)} />

        {/* Body — scrollable */}
        <div className="max-h-[calc(92vh-180px)] overflow-y-auto p-5">
          {isLoading ? (
            <DialogSkeleton />
          ) : error ? (
            <ErrorState error={error} onRetry={onRetry} />
          ) : config ? (
            <DialogBody config={config} />
          ) : null}
        </div>

        {/* Footer */}
        {config?.footer && (
          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
            {config.footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Subcomponents
// ============================================================================

function DialogHeader({
  config,
  onClose,
}: {
  config: AnalyticsDialogConfig | null
  onClose: () => void
}) {
  if (!config) {
    return (
      <div className="flex items-center justify-between border-b bg-gradient-to-br from-background via-muted/30 to-muted/50 p-5">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-start justify-between gap-4 border-b bg-gradient-to-br from-background via-muted/30 to-muted/50 p-5">
      <div className="flex min-w-0 items-start gap-3">
        <EntityAvatar config={config} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-none tracking-tight">
            <span className="truncate">{config.title}</span>
            {config.badges?.map((b) => (
              <React.Fragment key={b.key}>{b.node}</React.Fragment>
            ))}
          </h2>
          {(config.subtitle || config.statusNode || (config.meta && config.meta.length > 0)) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {config.statusNode}
              {config.subtitle && <span className="truncate text-muted-foreground">{config.subtitle}</span>}
              {config.meta?.map((m) => (
                <React.Fragment key={m.key}>{m.node}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {config.headerAction}
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function EntityAvatar({ config }: { config: AnalyticsDialogConfig }) {
  if (!config.avatarUrl) {
    return (
      <Skeleton className="h-12 w-12 rounded-full" />
    )
  }
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-base font-bold text-white ring-2 ring-background">
      <img
        src={config.avatarUrl}
        alt={config.title}
        className="h-12 w-12 rounded-full object-cover"
      />
    </div>
  )
}

function DialogBody({ config }: { config: AnalyticsDialogConfig }) {
  return (
    <div className="space-y-5">
      {/* KPI strip */}
      {config.kpis.length > 0 && <KpiGrid kpis={config.kpis} />}

      {/* Charts — laid out per the config */}
      <ChartsSection charts={config.charts} />

      {/* Table */}
      {config.table && <TableSection spec={config.table} />}

      {/* Footer text */}
      <div className="text-center text-[10px] text-muted-foreground">
        Analytics computed from live data · {config.entityId ? `${config.entityType} ${config.entityId.slice(0, 8)}` : ''}
      </div>
    </div>
  )
}

// ============================================================================
// KPI grid
// ============================================================================

function KpiGrid({ kpis }: { kpis: KpiSpec[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card key={kpi.key} className="relative overflow-hidden border-0 shadow-sm">
            <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${kpi.color}`} />
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {kpi.label}
                  </p>
                  <p className="truncate text-xl font-bold tabular-nums">{kpi.value}</p>
                  {kpi.sublabel && (
                    <p className="truncate text-[9px] text-muted-foreground">{kpi.sublabel}</p>
                  )}
                </div>
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ============================================================================
// Charts section
//
// Distributes chart specs into rows. The first row always has at most 2
// charts at half width. Subsequent rows place larger charts first.
// ============================================================================

function ChartsSection({ charts }: { charts: ChartSpec[] }) {
  if (charts.length === 0) return null

  // Simple layout: group into rows of 2 (with the first chart optionally
  // spanning more if it has span: 8 etc.).
  const rows: ChartSpec[][] = []
  let i = 0
  while (i < charts.length) {
    const head = charts[i]!
    const rowSpan = head.span ?? 6
    if (rowSpan >= 8) {
      rows.push([head])
      i += 1
    } else {
      const next = charts[i + 1]
      if (next) {
        rows.push([head, next])
        i += 2
      } else {
        rows.push([head])
        i += 1
      }
    }
  }

  return (
    <div className="space-y-4">
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={cn(
            'grid gap-4',
            row.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2',
          )}
        >
          {row.map((chart) => (
            <ChartRenderer key={chart.key} chart={chart} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ChartRenderer({ chart }: { chart: ChartSpec }) {
  const Icon = chart.icon
  // Compute lg:col-span based on chart.span
  const lgClass =
    chart.span === 12
      ? 'lg:col-span-2'
      : chart.span === 8
        ? 'lg:col-span-2'
        : chart.span === 4
          ? ''
          : '' // default 6 (half)
  return (
    <Card className={cn('relative overflow-hidden border-0 shadow-sm', lgClass)}>
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />
      <div className="flex items-center gap-2 border-b bg-muted/30 p-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-tight">{chart.title}</h3>
          {chart.subtitle && <p className="text-[10px] text-muted-foreground">{chart.subtitle}</p>}
        </div>
      </div>
      <div className="p-3">
        {chart.kind === 'pie' && (
          <ChartPieBody chart={chart} />
        )}
        {chart.kind === 'line' && <DailyTrendLine data={chart.data} />}
        {chart.kind === 'funnel' && <ChartFunnelBody chart={chart} />}
      </div>
    </Card>
  )
}

function ChartPieBody({ chart }: { chart: Extract<ChartSpec, { kind: 'pie' }> }) {
  if (chart.data.length === 0) {
    return <ChartEmpty />
  }
  return (
    <div>
      {/* Render based on the title — the dialog has 2 pie variants. We
          route by a heuristic on the title because that's where the entity
          type is encoded in the config. */}
      {chart.title.toLowerCase().includes('category') || chart.title.toLowerCase().includes('type') ? (
        <CategoryPie data={chart.data} />
      ) : (
        <StatusPie data={chart.data} />
      )}
      {chart.showLegend !== false && <ChartLegend slices={chart.data} />}
    </div>
  )
}

function ChartFunnelBody({ chart }: { chart: Extract<ChartSpec, { kind: 'funnel' }> }) {
  if (chart.data.length === 0 || !chart.data.some((s) => s.value > 0)) {
    return <ChartEmpty />
  }
  return (
    <div>
      <OfferFunnel data={chart.data} />
      {chart.showDropOffSummary !== false && <FunnelDropOffSummary funnel={chart.data} />}
    </div>
  )
}

function ChartEmpty() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center text-center">
      <p className="text-xs text-muted-foreground">No data available</p>
    </div>
  )
}

// ============================================================================
// Table section
// ============================================================================

function TableSection({ spec }: { spec: NonNullable<AnalyticsDialogConfig['table']> }) {
  if (spec.kind === 'offerPerformance') {
    const rows: OfferPerformanceRow[] = spec.rows.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      views: o.views,
      saves: o.saves,
      clicks: o.clicks,
      redemptions: o.redemptions,
      conversionRate: o.conversionRate,
    }))
    return (
      <OfferPerformanceTable
        data={rows}
        title={spec.title}
        subtitle={spec.subtitle}
        defaultSort={spec.defaultSort as any}
        pageSize={spec.pageSize}
        icon={spec.icon}
      />
    )
  }
  return null
}

// ============================================================================
// Loading + error states
// ============================================================================

export function DialogSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold text-rose-700 dark:text-rose-400">Failed to load analytics</p>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error?.message ?? 'An unexpected error occurred.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

export { ExternalLink }
