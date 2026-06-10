import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { BranchStatus, BranchType } from '@/types'

export const branchKeys = {
  all: ['merchant-branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...branchKeys.lists(), filters] as const,
  detail: (id: string) => [...branchKeys.all, 'detail', id] as const,
}

export interface BranchListFilters {
  status?: 'all' | 'active' | 'inactive'
  type?: BranchType | 'ALL'
  q?: string
  includeClosed?: boolean
}

export function useMerchantBranches(filters?: BranchListFilters) {
  return useQuery({
    queryKey: branchKeys.list(filters as unknown as Record<string, unknown> ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.type) params.set('type', filters.type)
      if (filters?.q) params.set('q', filters.q)
      if (filters?.includeClosed) params.set('includeClosed', 'true')
      const res = await fetch(`/api/merchant/branches?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to fetch branches')
      return json
    },
  })
}

export function useMerchantBranch(id: string) {
  return useQuery({
    queryKey: branchKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/merchant/branches/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to fetch branch')
      return json.data
    },
    enabled: !!id,
  })
}

export function useCreateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/merchant/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const err: any = new Error(json?.error?.message ?? 'Failed to create branch')
        err.details = json?.error?.details
        throw err
      }
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
    },
  })
}

export function useUpdateBranch(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/merchant/branches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const err: any = new Error(json?.error?.message ?? 'Failed to update branch')
        err.details = json?.error?.details
        throw err
      }
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
      queryClient.invalidateQueries({ queryKey: branchKeys.detail(id) })
    },
  })
}

export function useDeleteBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/merchant/branches/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to delete branch')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
    },
  })
}

export interface BranchDisplayBranch {
  id: string
  name: string
  city: string
  state: string | null
  status: BranchStatus
  isActive: boolean
  isPrimary: boolean
  branchType: BranchType
  createdAt: string | Date
  [key: string]: unknown
}
