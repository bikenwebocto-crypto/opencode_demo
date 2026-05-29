'use client'
import { useState, useCallback } from 'react'

interface UseTablePaginationOptions {
  defaultPageSize?: number
}

export function useTablePagination(opts?: UseTablePaginationOptions) {
  const [page, setPage] = useState(1)
  const pageSize = opts?.defaultPageSize ?? 10

  const resetPage = useCallback(() => setPage(1), [])

  return { page, setPage, pageSize, resetPage }
}
