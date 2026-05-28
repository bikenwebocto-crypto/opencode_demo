'use client'
import { useState, useCallback } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Skeleton } from '@/components/ui/skeleton'
import type { ColumnDef, TableSortConfig } from '@/types'

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  sortable?: boolean
  sortConfig?: TableSortConfig
  onSort?: (config: TableSortConfig) => void
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyMessage?: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
  keyExtractor: (row: T) => string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  sortable = true,
  sortConfig,
  onSort,
  onRowClick,
  isLoading,
  emptyMessage = 'No data found',
  pagination,
  keyExtractor,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<TableSortConfig | undefined>(sortConfig)
  const activeSort = sortConfig ?? localSort
  const setActiveSort = onSort ?? setLocalSort
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1

  const handleSort = useCallback((key: string) => {
    if (!sortable) return
    setActiveSort({
      key,
      direction: activeSort?.key === key && activeSort.direction === 'asc' ? 'desc' : 'asc',
    })
  }, [sortable, activeSort, setActiveSort])

  const SortIcon = ({ column }: { column: string }) => {
    if (activeSort?.key !== column) return <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
    return activeSort.direction === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 shrink-0" />
      : <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-4">
          {columns.map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'pb-3 font-medium',
                    col.sortable !== false && sortable && 'cursor-pointer select-none hover:text-foreground',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {col.sortable !== false && sortable && <SortIcon column={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const key = keyExtractor(row)
              return (
                <tr
                  key={key}
                  className={cn(
                    'border-b transition-colors last:border-0 hover:bg-muted/50',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => {
                    const cell = col.render ? col.render(row) : String(row[col.key] ?? '')
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'py-3',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                        )}
                      >
                        {cell}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-1">
            <button
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
