'use client'
import { useMerchantAnalyticsDetail } from '@/hooks/queries/use-merchant-analytics'
import { AnalyticsDialog } from '@/components/analytics/analytics-dialog'
import { buildMerchantAnalyticsConfig } from '@/features/merchants/config/merchant-analytics-config'

// ============================================================================
// MerchantAnalyticsDialog
//
// Thin wrapper that wires the merchant analytics hook into the generic
// config-driven <AnalyticsDialog>. All UI lives in AnalyticsDialog — this
// file only:
//   1. Loads the data via the merchant hook
//   2. Builds the dialog config from the response
//   3. Hands both to the dialog
//
// Reusable: any caller can drop this in next to a merchant card.
// ============================================================================

interface MerchantAnalyticsDialogProps {
  merchantId: string
  merchantName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MerchantAnalyticsDialog({
  merchantId,
  merchantName,
  open,
  onOpenChange,
}: MerchantAnalyticsDialogProps) {
  const { data, isLoading, error, refetch } = useMerchantAnalyticsDetail(
    open ? merchantId : null,
  )

  // Build the config from the loaded data. While loading or on error the
  // config is null and the dialog renders its skeleton/error state.
  const config = data
    ? buildMerchantAnalyticsConfig(data)
    : merchantName
      ? // Pre-load a placeholder so the dialog title doesn't jump from
        // "Loading..." to the merchant name.
        ({
          entityType: 'merchant' as const,
          entityId: merchantId,
          title: merchantName,
          kpis: [],
          charts: [],
        }
        )
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
