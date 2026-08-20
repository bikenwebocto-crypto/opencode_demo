'use client'
import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export interface ColumnDef<T> {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render?: (value: any, row: T, index: number) => React.ReactNode
  width?: string
  className?: string
}

export interface AnalyticsTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  keyExtractor: (row: T, index: number) => string | number
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ElementType
  emptyAction?: React.ReactNode
  title?: string
  subtitle?: string
  headerIcon?: React.ElementType
  onRowClick?: (row: T) => void
}

export function AnalyticsTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  defaultSort,
  pageSize = 5,
  loading,
  emptyMessage = 'No data',
  emptyIcon: EmptyIcon,
  emptyAction,
  title,
  subtitle,
  headerIcon: HeaderIcon,
  onRowClick,
}: AnalyticsTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort) return data
    const arr = [...data]
    const col = columns.find((c) => c.key === sort.key)
    if (!col || !col.sortable) return arr
    arr.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av
      }
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
    return arr
  }, [data, sort, columns])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const paged = sorted.slice(start, end)

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'desc' }
    })
    setPage(1)
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {(title || HeaderIcon) && (
          <div className="flex items-center gap-2 border-b bg-muted/30 p-4">
            {HeaderIcon && (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <HeaderIcon className="h-4 w-4" />
              </div>
            )}
            <div>
              {title && <h3 className="text-sm font-semibold">{title}</h3>}
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
        )}
        <div className="space-y-2 p-3">
          {Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      {(title || HeaderIcon) && (
        <div className="flex items-center gap-2 border-b bg-muted/30 p-4">
          {HeaderIcon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <HeaderIcon className="h-4 w-4" />
            </div>
          )}
          <div>
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2 font-medium',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                        sort?.key === col.key && 'text-foreground',
                      )}
                    >
                      {col.label}
                      {sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length > 0 ? (
              paged.map((row, i) => {
                const key = keyExtractor(row, start + i)
                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-b transition-colors last:border-0 hover:bg-muted/30',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => {
                      const value = row[col.key]
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'px-3 py-2',
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                            col.className,
                          )}
                        >
                          {col.render ? col.render(value, row, start + i) : value}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    {EmptyIcon && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <EmptyIcon className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                    )}
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {emptyAction}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Showing {start + 1}–{Math.min(end, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-1.5 text-[11px] text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
