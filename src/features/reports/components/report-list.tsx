'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download } from 'lucide-react'

interface Report {
  id: string
  name: string
  description: string
  category: string
  lastGenerated: string | null
  status: string
}

interface ReportListProps {
  reports: Report[]
  onGenerate?: (id: string) => void
}

export function ReportList({ reports, onGenerate }: ReportListProps) {
  if (reports.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No reports available</p>
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {reports.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <FileText className="h-5 w-5 text-muted-foreground" />
              {onGenerate && (
                <Button size="sm" variant="outline" onClick={() => onGenerate(r.id)}>
                  <Download className="mr-1 h-4 w-4" /> Generate
                </Button>
              )}
            </div>
            <CardTitle className="text-base mt-2">{r.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{r.category}</span>
              <span>{r.lastGenerated ? `Last generated: ${new Date(r.lastGenerated).toLocaleDateString()}` : 'Never generated'}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
