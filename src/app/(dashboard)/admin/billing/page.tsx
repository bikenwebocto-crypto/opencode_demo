'use client'
import { PageHeader } from '@/components/shared/page-header'
import { BillingOverview } from '@/features/billing/components/billing-overview'
import { BillingHistory } from '@/features/billing/components/billing-history'

const mockPlan = { name: 'Enterprise', amount: 4999, period: 'Monthly', nextBilling: '2026-06-01' }
const mockUsage = { activeEmployees: 342, includedEmployees: 500, additionalCost: 0 }

const mockInvoices = [
  { id: 'inv-001', amount: 4999, status: 'paid' as const, period: 'May 2026', paidAt: '2026-05-01T10:00:00' },
  { id: 'inv-002', amount: 4999, status: 'paid' as const, period: 'April 2026', paidAt: '2026-04-01T10:00:00' },
  { id: 'inv-003', amount: 4999, status: 'paid' as const, period: 'March 2026', paidAt: '2026-03-01T10:00:00' },
  { id: 'inv-004', amount: 4999, status: 'pending' as const, period: 'June 2026', paidAt: null },
]

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Manage subscription plan and view invoices" />
      <BillingOverview plan={mockPlan} usage={mockUsage} />
      <div>
        <h2 className="mb-3 text-lg font-semibold">Billing History</h2>
        <BillingHistory invoices={mockInvoices} />
      </div>
    </div>
  )
}
