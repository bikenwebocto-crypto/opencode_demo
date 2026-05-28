'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface ActionQueueStatsProps {
  pending: number
  inProgress: number
  completed: number
  failed: number
}

export function ActionQueueStats({ pending, inProgress, completed, failed }: ActionQueueStatsProps) {
  const stats = [
    { label: 'Pending', value: pending, icon: Clock, color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' },
    { label: 'In Progress', value: inProgress, icon: Loader2, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30' },
    { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
    { label: 'Failed', value: failed, icon: AlertCircle, color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
