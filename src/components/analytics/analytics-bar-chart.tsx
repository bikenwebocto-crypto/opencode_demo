'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { BarChart3 } from 'lucide-react'

export interface BarSpec {
  key: string
  color: string
  name?: string
  stackId?: string
}

export interface AnalyticsBarChartProps {
  data: Record<string, any>[]
  xKey: string
  bars: BarSpec[]
  height?: number
  emptyMessage?: string
  stacked?: boolean
  showGrid?: boolean
  borderRadius?: number
  barSize?: number
  xTickFormatter?: (value: string) => string
  tooltipFormatter?: (value: any, name: string) => [string, string]
}

function DefaultTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export function AnalyticsBarChart({
  data,
  xKey,
  bars,
  height = 220,
  emptyMessage = 'No data',
  stacked = false,
  showGrid = true,
  borderRadius = 4,
  barSize,
  xTickFormatter,
  tooltipFormatter,
}: AnalyticsBarChartProps) {
  if (!data.some((d) => bars.some((b) => (d[b.key] ?? 0) > 0))) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height }}
      >
        <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barSize={barSize}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        )}
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10 }}
          tickFormatter={xTickFormatter}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          content={<DefaultTooltip />}
          formatter={tooltipFormatter}
        />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name ?? bar.key}
            fill={bar.color}
            stackId={stacked ? (bar.stackId ?? 'stack') : undefined}
            radius={[borderRadius, borderRadius, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
