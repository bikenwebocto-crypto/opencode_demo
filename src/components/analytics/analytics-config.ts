'use client'
import * as React from 'react'
import type { ChartSlice } from '@/types'

// ============================================================================
// AnalyticsDialogConfig
//
// Config-driven shape consumed by the unified <AnalyticsDialog> component.
// Each entity (merchant, company) has a small builder that maps its raw
// analytics payload into this config.
//
// The dialog itself reads ONLY the fields below — it does not know what
// "merchant" or "company" means.
// ============================================================================

export type AnalyticsEntityType = 'merchant' | 'company'

/**
 * A KPI tile shown in the overview strip at the top of the dialog.
 */
export interface KpiSpec {
  /** Stable key (used for React list rendering only) */
  key: string
  /** Short label shown above the value */
  label: string
  /** Value to display. Can be a number, formatted string, or pre-formatted display */
  value: number | string
  /** Optional sublabel (e.g. "of 100 max") */
  sublabel?: string
  /** Lucide icon component */
  icon: React.ElementType
  /** Tailwind gradient classes for the top accent (e.g. "from-blue-500 to-indigo-600") */
  color: string
  /** Tailwind classes for the icon background tile */
  bg: string
  /** Tailwind classes for the icon color */
  iconColor: string
}

/**
 * A chart card to display. The dialog knows how to render each `kind`
 * using the existing reusable chart components in analytics-charts.tsx.
 */
export type ChartSpec =
  | {
      key: string
      kind: 'pie'
      title: string
      subtitle?: string
      icon: React.ElementType
      data: ChartSlice[]
      /** Span (out of 12) for grid placement in the chart row */
      span?: 4 | 6 | 8 | 12
      showLegend?: boolean
    }
  | {
      key: string
      kind: 'line'
      title: string
      subtitle?: string
      icon: React.ElementType
      data: Array<{ date: string; redemptions: number; savings?: number; views?: number }>
      span?: 4 | 6 | 8 | 12
    }
  | {
      key: string
      kind: 'funnel'
      title: string
      subtitle?: string
      icon: React.ElementType
      data: ChartSlice[]
      showDropOffSummary?: boolean
      span?: 4 | 6 | 8 | 12
    }

/**
 * An optional table to show below the charts. Currently the Offer
 * Performance table is the only built-in — for other entities, the
 * dialog renders a "no table" state.
 */
export interface TableSpec {
  /** Stable key */
  key: string
  /** Component key — currently only 'offerPerformance' is supported */
  kind: 'offerPerformance'
  title: string
  subtitle?: string
  icon: React.ElementType
  /** Raw rows — the dialog will pass them through the table's data prop */
  rows: any[]
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
}

/**
 * Header badge element (e.g. "Featured" pill, "Homepage" pill)
 */
export interface HeaderBadgeSpec {
  key: string
  node: React.ReactNode
}

/**
 * Header meta element (small line of metadata next to the title)
 */
export interface HeaderMetaSpec {
  key: string
  node: React.ReactNode
}

/**
 * The full dialog config. Built by entity-specific builder functions.
 */
export interface AnalyticsDialogConfig {
  entityType: AnalyticsEntityType
  entityId: string

  // Header
  title: string
  subtitle?: string
  avatarUrl?: string | null
  statusNode?: React.ReactNode
  badges?: HeaderBadgeSpec[]
  meta?: HeaderMetaSpec[]
  headerAction?: React.ReactNode

  // Footer
  footer?: React.ReactNode

  // Body
  kpis: KpiSpec[]
  charts: ChartSpec[]
  table?: TableSpec

  // Layout options
  /** Distribution of chart rows. Defaults to a 1+1 + 2+1 split. */
  chartLayout?: 'standard' | 'merchant' | 'company'
}

/**
 * The raw analytics payload type. The dialog does not import this directly —
 * the entity-specific builder uses it to populate the config.
 */
export interface AnalyticsDialogData<TRaw = unknown> {
  raw: TRaw
}
