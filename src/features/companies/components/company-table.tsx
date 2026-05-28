'use client'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface CompanyRow {
  id: string
  name: string
  email: string
  status: string
  employeeCount: number
  activeRedemptions: number
  joinedAt: string
}

interface CompanyTableProps {
  companies: CompanyRow[]
  isLoading?: boolean
  onRowClick?: (company: CompanyRow) => void
}

export function CompanyTable({ companies, isLoading, onRowClick }: CompanyTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }
  if (companies.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No companies found</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 font-medium">Company</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 text-center font-medium">Employees</th>
            <th className="pb-3 text-center font-medium">Active Redemptions</th>
            <th className="pb-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
              onClick={() => onRowClick?.(c)}
            >
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{c.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3"><StatusBadge status={c.status} /></td>
              <td className="py-3 text-center">{c.employeeCount}</td>
              <td className="py-3 text-center">{c.activeRedemptions}</td>
              <td className="py-3 text-muted-foreground">{new Date(c.joinedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
