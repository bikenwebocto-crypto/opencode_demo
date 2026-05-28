'use client'
import { useCallback } from 'react'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'

export interface EmployeeRow {
  id: string
  name: string
  email: string
  companyId: string
  companyName: string
  department: string
  status: string
  totalRedemptions: number
  joinedAt: string
}

interface EmployeeTableProps {
  employees: EmployeeRow[]
  selectedIds: Set<string>
  onSelectChange: (ids: Set<string>) => void
  isLoading?: boolean
}

export function EmployeeTable({ employees, selectedIds, onSelectChange, isLoading }: EmployeeTableProps) {
  const allSelected = employees.length > 0 && employees.every((e) => selectedIds.has(e.id))
  const someSelected = employees.some((e) => selectedIds.has(e.id)) && !allSelected

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onSelectChange(new Set())
    } else {
      onSelectChange(new Set(employees.map((e) => e.id)))
    }
  }, [allSelected, employees, onSelectChange])

  const toggleOne = useCallback((id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectChange(next)
  }, [selectedIds, onSelectChange])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }
  if (employees.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No employees found</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="w-10 pb-3">
              <Checkbox checked={allSelected} indeterminate={someSelected} onCheckedChange={toggleAll} />
            </th>
            <th className="pb-3 font-medium">Employee</th>
            <th className="pb-3 font-medium">Company</th>
            <th className="pb-3 font-medium">Department</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 text-center font-medium">Redemptions</th>
            <th className="pb-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr
              key={e.id}
              className="border-b transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="py-3" onClick={(ev) => ev.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(e.id)}
                  onCheckedChange={() => toggleOne(e.id)}
                />
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{e.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 text-muted-foreground">{e.companyName}</td>
              <td className="py-3">{e.department}</td>
              <td className="py-3"><StatusBadge status={e.status} /></td>
              <td className="py-3 text-center">{e.totalRedemptions}</td>
              <td className="py-3 text-muted-foreground">{new Date(e.joinedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
