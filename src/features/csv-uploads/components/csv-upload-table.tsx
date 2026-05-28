'use client'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'

interface CSVUploadRow {
  id: string
  filename: string
  status: string
  totalRows: number
  successCount: number
  errorCount: number
  uploadedAt: string
}

interface CSVUploadTableProps {
  uploads: CSVUploadRow[]
  isLoading?: boolean
}

export function CSVUploadTable({ uploads, isLoading }: CSVUploadTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }
  if (uploads.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No uploads found</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 font-medium">Filename</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 text-center font-medium">Total Rows</th>
            <th className="pb-3 text-center font-medium">Success</th>
            <th className="pb-3 text-center font-medium">Errors</th>
            <th className="pb-3 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((u) => (
            <tr key={u.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
              <td className="py-3 font-medium">{u.filename}</td>
              <td className="py-3"><StatusBadge status={u.status} /></td>
              <td className="py-3 text-center">{u.totalRows}</td>
              <td className="py-3 text-center text-green-600">{u.successCount}</td>
              <td className="py-3 text-center text-red-600">{u.errorCount}</td>
              <td className="py-3 text-muted-foreground">{new Date(u.uploadedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
