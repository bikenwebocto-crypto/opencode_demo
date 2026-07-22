'use client'
import { use } from 'react'
import { useMerchantOfferById } from '@/hooks/queries/use-merchant-offers'
import { OfferForm } from '@/features/merchant/offers/components/offer-form'
import { Skeleton } from '@/components/ui/skeleton'

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useMerchantOfferById(id)

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>

  if (error || !data?.data) return <p className="py-12 text-center text-muted-foreground">Offer not found</p>

  const offer = data.data
  const pricingConfig = (offer.pricing?.configuration as Record<string, unknown>) ?? {}
  const redemptionConfig = (offer.redemption?.configuration as Record<string, unknown>) ?? {}

  return (
    <OfferForm
      offerId={id}
      initialData={{
        title: offer.title ?? '',
        description: offer.content?.description ?? '',
        shortDescription: offer.content?.shortDescription ?? '',
        termsAndConditions: offer.content?.termsAndConditions ?? '',
        imageUrls: Array.isArray(offer.content?.imageUrls) ? offer.content.imageUrls : [],
        categoryId: offer.categoryId ?? '',
        offerType: offer.offerType ?? 'flat_rate',
        discountValue: String(pricingConfig.amount ?? pricingConfig.percent ?? ''),
        discountMax: pricingConfig.maximumDiscount ? String(pricingConfig.maximumDiscount) : '',
        discountPercent: pricingConfig.percent ? String(pricingConfig.percent) : '',
        minimumSpend: pricingConfig.minimumSpend ? String(pricingConfig.minimumSpend) : '',
        maxRedemptions: offer.redemption?.maxRedemptions ? String(offer.redemption.maxRedemptions) : '',
        startDate: offer.startDate ? new Date(offer.startDate).toISOString().slice(0, 16) : '',
        endDate: offer.endDate ? new Date(offer.endDate).toISOString().slice(0, 16) : '',
        daysOfWeek: Array.isArray(offer.redemption?.daysOfWeek) ? offer.redemption.daysOfWeek.join(',') : '0,1,2,3,4,5,6',
        redemptionCode: redemptionConfig.code as string ?? '',
        redemptionInstructions: redemptionConfig.instructions as string ?? '',
      }}
    />
  )
}
