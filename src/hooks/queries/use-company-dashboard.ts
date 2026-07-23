'use client'

import { useQuery } from '@tanstack/react-query'

export interface CompanyDashboard {
  enrolledEmployees: number
  activeThisMonth: number
  activationRate: number
  redemptionsThisMonth: number
  totalSavings: number
  nextBillingDate: string | null
  estimatedRenewalAmount: number
  plan: string
  billingStatus: string
  alerts: { type: string; message: string; severity: 'info' | 'warning' | 'error' }[]
}

export const companyDashboardKeys = {
  all: ['companyDashboard'] as const,
}

export function useCompanyDashboard() {
  return useQuery({
    queryKey: companyDashboardKeys.all,
    queryFn: async (): Promise<CompanyDashboard> => {
      const res = await fetch('/api/company/dashboard')
      const body = await res.json()
      if (!res.ok || !body.success) {
        const code = body.error?.code
        const msg = body.error?.message ?? 'Failed to fetch dashboard'
        const err = new Error(msg) as Error & { code?: string }
        err.code = code
        throw err
      }
      return body.data
    },
    refetchInterval: 30000,
  })
}
