'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompanyBilling } from '@/hooks/queries/use-company-billing'
import { CreditCard, Calendar, DollarSign, Users } from 'lucide-react'

export default function CompanyBillingPage() {
  const { data: billing, isLoading, error } = useCompanyBilling()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !billing) {
    return <p className="py-12 text-center text-muted-foreground">Failed to load billing information</p>
  }

  const usagePercent = billing.includedEmployees > 0
    ? Math.min((billing.activeEmployees / billing.includedEmployees) * 100, 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">View your billing information and subscription details</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{billing.plan}</p>
            <p className="text-sm text-muted-foreground">
              ${billing.pricePerEmployee.toFixed(2)} / {billing.billingCycle} per employee
            </p>
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={billing.billingStatus} />
              {billing.isTrial && <span className="text-xs text-muted-foreground">Trial{billing.trialEndsAt ? ` ends ${new Date(billing.trialEndsAt).toLocaleDateString()}` : ''}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span><Users className="mr-1 inline h-4 w-4" />{billing.activeEmployees} / {billing.includedEmployees} active employees</span>
              <span className="font-medium">{usagePercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
            </div>
            <p className="mt-2 text-sm font-medium">
              Estimated monthly: <span className="text-primary">${billing.estimatedMonthlyCost.toFixed(2)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Billing Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Billing Email</dt>
              <dd className="text-sm font-medium">{billing.billingEmail}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Billing Cycle</dt>
              <dd className="text-sm font-medium capitalize">{billing.billingCycle}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Price per Employee</dt>
              <dd className="text-sm font-medium">${billing.pricePerEmployee.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Currency</dt>
              <dd className="text-sm font-medium">{billing.currency}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Renewal Date</dt>
              <dd className="text-sm font-medium">{billing.renewalDate ? new Date(billing.renewalDate).toLocaleDateString() : 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Next Billing</dt>
              <dd className="text-sm font-medium">{billing.nextBillingDate ? new Date(billing.nextBillingDate).toLocaleDateString() : 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Total Paid</dt>
              <dd className="text-sm font-medium">${billing.totalPaid.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Invoices</dt>
              <dd className="text-sm font-medium">{billing.invoiceCount}</dd>
            </div>
            {billing.paymentMethodLast4 && (
              <div>
                <dt className="text-sm text-muted-foreground">Payment Method</dt>
                <dd className="text-sm font-medium">•••• {billing.paymentMethodLast4}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
