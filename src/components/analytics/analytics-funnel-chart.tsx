'use client'
import { FunnelChart, Funnel, Cell, Tooltip, ResponsiveContainer, LabelList } from 'recharts'

export interface FunnelStage {
  name: string
  value: number
  color?: string
}

export interface AnalyticsFunnelChartProps {
  data: FunnelStage[]
  height?: number
  emptyMessage?: string
  showDropOffSummary?: boolean
  stageLabels?: string[]
  colors?: string[]
}

const DEFAULT_FUNNEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

function FunnelTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as FunnelStage
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">
        Value: <span className="font-semibold text-foreground">{d.value}</span>
      </p>
    </div>
  )
}

function DropOffSummary({
  funnel,
  stageLabels,
}: {
  funnel: FunnelStage[]
  stageLabels?: string[]
}) {
  if (funnel.length < 2) return null
  const dropOffs: Array<{ from: string; to: string; pct: number }> = []
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1]?.value ?? 0
    const curr = funnel[i]?.value ?? 0
    if (prev > 0) {
      const dropOff = ((prev - curr) / prev) * 100
      dropOffs.push({ from: stageLabels?.[i - 1] ?? funnel[i - 1]!.name, to: stageLabels?.[i] ?? funnel[i]!.name, pct: dropOff })
    }
  }
  if (dropOffs.length === 0) return null
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-[10px]">
      {dropOffs.map((d, i) => (
        <div key={i} className="text-center">
          <p className="text-muted-foreground">
            {d.from} → {d.to}
          </p>
          <p className="font-semibold text-rose-600">−{d.pct.toFixed(1)}%</p>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsFunnelChart({
  data,
  height = 220,
  emptyMessage = 'No funnel data',
  showDropOffSummary = true,
  stageLabels,
  colors = DEFAULT_FUNNEL_COLORS,
}: AnalyticsFunnelChartProps) {
  if (data.length === 0 || !data.some((s) => s.value > 0)) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height }}
      >
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <FunnelChart>
          <Tooltip content={<FunnelTooltip />} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? colors[i % colors.length]} />
            ))}
            <LabelList
              position="right"
              fill="#0f172a"
              stroke="none"
              dataKey="name"
              fontSize={12}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      {showDropOffSummary && <DropOffSummary funnel={data} stageLabels={stageLabels} />}
    </div>
  )
}
