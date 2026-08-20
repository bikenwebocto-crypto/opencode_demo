'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp } from 'lucide-react'

export interface LineSpec {
  key: string
  color: string
  name?: string
  width?: number
  dot?: boolean
}

export interface AnalyticsLineChartProps {
  data: Record<string, any>[]
  xKey: string
  lines: LineSpec[]
  height?: number
  emptyMessage?: string
  showGrid?: boolean
  xTickFormatter?: (value: string) => string
  tooltipFormatter?: (value: any, name: string) => [string, string]
  labelFormatter?: (label: string) => string
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

export function AnalyticsLineChart({
  data,
  xKey,
  lines,
  height = 220,
  emptyMessage = 'No data',
  showGrid = true,
  xTickFormatter,
  tooltipFormatter,
  labelFormatter,
}: AnalyticsLineChartProps) {
  if (!data.some((d) => lines.some((l) => (d[l.key] ?? 0) > 0))) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height }}
      >
        <TrendingUp className="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
          labelFormatter={labelFormatter}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name ?? line.key}
            stroke={line.color}
            strokeWidth={line.width ?? 2.5}
            dot={line.dot !== false ? { r: 3, fill: line.color } : false}
            activeDot={line.dot !== false ? { r: 5 } : false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
