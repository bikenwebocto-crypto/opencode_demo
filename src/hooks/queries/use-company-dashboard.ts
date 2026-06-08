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
      if (!res.ok) throw new Error('Failed to fetch dashboard')
      const body = await res.json()
      if (!body.success) throw new Error(body.error?.message ?? 'Failed to fetch dashboard')
      return body.data
    },
    refetchInterval: 30000,
  })
}
