'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Calendar,
  Receipt,
  Info,
  CreditCard,
  Mail,
  CircleAlert,
} from 'lucide-react'
import { useCompanyBilling } from '@/hooks/queries/use-company-billing'

const PRICE_PER_EMPLOYEE_EUR = 1.86
const VAT_RATE = 0.19
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@example.com'

type BillingStatus = 'ACTIVE' | 'INVOICE_OVERDUE' | 'ON_HOLD' | string

const STATUS_STYLES: Record<
  BillingStatus,
  { label: string; classes: string; dot: string }
> = {
  ACTIVE: {
    label: 'ACTIVE',
    classes:
      'bg-green-100 text-green-300 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700',
    dot: 'bg-green-600',
  },
  INVOICE_OVERDUE: {
    label: 'INVOICE OVERDUE',
    classes:
      'bg-amber-100 text-amber-300 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
    dot: 'bg-amber-600',
  },
  ON_HOLD: {
    label: 'ON HOLD',
    classes:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700',
    dot: 'bg-red-600',
  },
}

const FALLBACK_STATUS_STYLE = {
  label: 'UNKNOWN',
  classes:
    'bg-muted text-muted-foreground border-border',
  dot: 'bg-muted-foreground',
}

function formatLongDate(d: string | Date | null | undefined): string | null {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  })
}

function StatusPill({ status }: { status: BillingStatus | null | undefined }) {
  if (!status) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${FALLBACK_STATUS_STYLE.classes}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${FALLBACK_STATUS_STYLE.dot}`}
          aria-hidden="true"
        />
        NOT SET
      </span>
    )
  }
  const style = STATUS_STYLES[status] ?? {
    ...FALLBACK_STATUS_STYLE,
    label: status,
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.classes}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      {style.label}
    </span>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm italic text-muted-foreground">{children}</p>
  )
}

export default function CompanyBillingPage() {
  const { data: billing, isLoading, error } = useCompanyBilling()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (error || !billing) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View your subscription and renewal information
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <CircleAlert className="h-5 w-5 shrink-0" />
            <p>
              We couldn&apos;t load your billing record right now. Please try
              again later or contact support if the issue persists.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Indicative renewal amount — uses CURRENT enrolled count only.
  // Spec formula: employeeCount × 1.86 × 12, plus 19% VAT.
  const enrolledCount = billing.activeEmployees ?? 0
  const subtotal = enrolledCount * PRICE_PER_EMPLOYEE_EUR * 12
  const vat = subtotal * VAT_RATE
  const total = subtotal + vat

  const renewalDateLong = formatLongDate(billing.renewalDate)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your subscription and renewal information
        </p>
      </div>

      {/* ENROLLED COUNT + BILLING STATUS (side-by-side on desktop) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Enrolled Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{enrolledCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your subscription is based on your employee count.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Billing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPill status={billing.billingStatus} />
            <p className="mt-3 text-sm text-muted-foreground">
              {billing.billingStatus === 'ACTIVE' &&
                'Your account is in good standing.'}
              {billing.billingStatus === 'INVOICE_OVERDUE' &&
                'An invoice is overdue. Please contact support to settle.'}
              {billing.billingStatus === 'ON_HOLD' &&
                'Your account is on hold. Please contact support to restore access.'}
              {!['ACTIVE', 'INVOICE_OVERDUE', 'ON_HOLD'].includes(
                billing.billingStatus ?? '',
              ) &&
                'Status will be updated by our billing team.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RENEWAL DATE */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Renewal Date</CardTitle>
        </CardHeader>
        <CardContent>
          {renewalDateLong ? (
            <p className="text-lg font-medium">
              Your plan renews on {renewalDateLong}
            </p>
          ) : (
            <EmptyHint>No renewal date is currently set.</EmptyHint>
          )}
        </CardContent>
      </Card>

      {/* PRICING NOTE (static) */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="font-semibold">€1.86</span> per employee per
            month, billed annually + 19% VAT.
          </p>
        </CardContent>
      </Card>

      {/* INDICATIVE RENEWAL AMOUNT */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Indicative Renewal Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {enrolledCount > 0 ? (
            <p className="text-sm">
              Based on your current enrolled count of{' '}
              <span className="font-semibold">{enrolledCount}</span>, your next
              renewal invoice is estimated at{' '}
              <span className="font-semibold">{formatCurrency(total)}</span>.
            </p>
          ) : (
            <EmptyHint>
              Add employees to see your indicative renewal amount.
            </EmptyHint>
          )}
          <p className="text-xs text-muted-foreground">
            Final amount is based on your peak headcount during the 30 days
            before renewal.
          </p>
          {enrolledCount > 0 && (
            <dl className="mt-3 grid grid-cols-1 gap-1 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatCurrency(subtotal)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">VAT (19%)</dt>
                <dd className="font-medium">{formatCurrency(vat)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estimated total</dt>
                <dd className="font-semibold">{formatCurrency(total)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* RENEWAL BILLING EXPLANATION */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">How renewal pricing works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Renewal pricing is based on <strong>peak headcount</strong>.
          </p>
          <p>
            The renewal invoice amount is <strong>not</strong> based on the
            employee count on the day of renewal. It is based on the highest
            enrolled count recorded during the 30 days before the renewal date.
          </p>
          <p>
            This protects against employee removals shortly before renewal.
          </p>
          <p>The amount shown above is only an estimate.</p>
        </CardContent>
      </Card>

      {/* PAYMENT INFORMATION (read-only) */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Payment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">
            No online payment processing is available.
          </p>
          <p className="text-muted-foreground">
            Payments are handled by bank transfer. To discuss an invoice or make
            a payment, contact support.
          </p>
        </CardContent>
      </Card>

      {/* CONTACT SUPPORT CTA */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Need help?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            Questions about your invoice?
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Contact us
            <span aria-hidden="true">→</span>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
