/**
 * Aggregation helpers for the Admin Billing dashboard.
 */

import { prisma } from '@/lib/prisma'
import { readPeak, countActiveEmployees } from './peak-headcount'
import { computeGamingAlert } from './gaming-alert'

export interface CompanyBillingRow {
  companyId: string
  companyName: string
  status: string
  currentEmployees: number
  peakEnrolled30d: number | null
  renewalDate: Date | null
  hasGamingAlert: boolean
  dropPercent: number
  alertThreshold: number
}

export interface BillingSummary {
  activeCompanies: number
  invoiceOverdueCompanies: number
  onHoldCompanies: number
  renewingWithin30Days: number
  companiesWithGamingAlert: number
  totalPeakHeadcountPendingRenewal: number
  generatedAt: string
}

function isWithinDays(date: Date | null, days: number): boolean {
  if (!date) return false
  const now = Date.now()
  const target = date.getTime()
  if (target < now) return false
  const diffDays = (target - now) / (1000 * 60 * 60 * 24)
  return diffDays <= days
}

export async function buildCompanyBillingRow(
  companyId: string,
): Promise<CompanyBillingRow | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, deletedAt: true },
  })
  if (!company || company.deletedAt) return null

  const billing = await prisma.companyBilling.findUnique({
    where: { companyId },
    select: {
      billingStatus: true,
      renewalDate: true,
      nextBillingDate: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
    },
  })

  const effectiveRenewalDate =
    billing?.renewalDate ??
    billing?.nextBillingDate ??
    billing?.currentPeriodEnd ??
    billing?.trialEndsAt ??
    null

  const [peakRecord, currentEmployees] = await Promise.all([
    readPeak(companyId),
    countActiveEmployees(companyId),
  ])

  const alert = computeGamingAlert({
    currentEmployees,
    peakEnrolled30d: peakRecord?.peak ?? null,
  })

  return {
    companyId: company.id,
    companyName: company.name,
    status: billing?.billingStatus ?? 'ACTIVE',
    currentEmployees,
    peakEnrolled30d: peakRecord?.peak ?? null,
    renewalDate: effectiveRenewalDate,
    hasGamingAlert: alert.active,
    dropPercent: alert.dropPercent,
    alertThreshold: alert.threshold,
  }
}

export async function buildBillingSummary(): Promise<BillingSummary> {
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true },
  })

  const rows = await Promise.all(
    companies.map((c) => buildCompanyBillingRow(c.id)),
  )
  const valid = rows.filter((r): r is CompanyBillingRow => r !== null)

  let totalPeak = 0
  for (const r of valid) {
    if (r.peakEnrolled30d !== null && isWithinDays(r.renewalDate, 30)) {
      totalPeak += r.peakEnrolled30d
    }
  }

  return {
    activeCompanies: valid.filter((r) => r.status === 'ACTIVE').length,
    invoiceOverdueCompanies: valid.filter((r) => r.status === 'INVOICE_OVERDUE')
      .length,
    onHoldCompanies: valid.filter((r) => r.status === 'ON_HOLD').length,
    renewingWithin30Days: valid.filter((r) =>
      isWithinDays(r.renewalDate, 30),
    ).length,
    companiesWithGamingAlert: valid.filter((r) => r.hasGamingAlert).length,
    totalPeakHeadcountPendingRenewal: totalPeak,
    generatedAt: new Date().toISOString(),
  }
}
