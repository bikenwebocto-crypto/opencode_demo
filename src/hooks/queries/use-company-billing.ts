'use client'

import { useQuery } from '@tanstack/react-query'

export interface CompanyBilling {
  plan: string
  billingEmail: string
  billingCycle: string
  pricePerEmployee: number
  currency: string
  nextBillingDate: string | null
  renewalDate: string | null
  billingStatus: string
  isTrial: boolean
  trialEndsAt: string | null
  totalPaid: number
  invoiceCount: number
  paymentMethodLast4: string | null
  activeEmployees: number
  includedEmployees: number
  estimatedMonthlyCost: number
}

export const companyBillingKeys = {
  all: ['companyBilling'] as const,
}

export function useCompanyBilling() {
  return useQuery({
    queryKey: companyBillingKeys.all,
    queryFn: async (): Promise<CompanyBilling> => {
      const res = await fetch('/api/company/billing')
      if (!res.ok) throw new Error('Failed to fetch billing')
      const body = await res.json()
      if (!body.success) throw new Error(body.error?.message ?? 'Failed to fetch billing')
      return body.data
    },
  })
}
