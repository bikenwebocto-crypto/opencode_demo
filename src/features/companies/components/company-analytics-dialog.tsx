'use client'
import { useCompanyAnalyticsDetail } from '@/hooks/queries/use-company-analytics'
import { AnalyticsDialog } from '@/components/analytics/analytics-dialog'
import { buildCompanyAnalyticsConfig } from '@/features/companies/config/company-analytics-config'

// ============================================================================
// CompanyAnalyticsDialog
//
// Same shape as MerchantAnalyticsDialog — only the hook and config builder
// differ. Both use the generic <AnalyticsDialog> underneath.
// ============================================================================

interface CompanyAnalyticsDialogProps {
  companyId: string
  companyName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyAnalyticsDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
}: CompanyAnalyticsDialogProps) {
  const { data, isLoading, error, refetch } = useCompanyAnalyticsDetail(
    open ? companyId : null,
  )

  const config = data
    ? buildCompanyAnalyticsConfig(data)
    : companyName
      ? {
          entityType: 'company' as const,
          entityId: companyId,
          title: companyName,
          kpis: [],
          charts: [],
        }
      : null

  return (
    <AnalyticsDialog
      config={config}
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      isLoading={isLoading}
      error={error as Error | null}
      onRetry={() => refetch()}
    />
  )
}
