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

  return (
    <OfferForm
      offerId={id}
      initialData={{
        title: offer.title ?? '',
        description: offer.description ?? '',
        shortDescription: offer.shortDescription ?? '',
        termsAndConditions: offer.termsAndConditions ?? '',
        imageUrls: Array.isArray(offer.imageUrls) ? offer.imageUrls.join(', ') : '',
        offerType: offer.offerType ?? 'FLAT',
        discountValue: String(offer.discountValue ?? ''),
        discountMax: offer.discountMax ? String(offer.discountMax) : '',
        discountPercent: offer.discountPercent ? String(offer.discountPercent) : '',
        minimumSpend: offer.minimumSpend ? String(offer.minimumSpend) : '',
        maxRedemptions: offer.maxRedemptions ? String(offer.maxRedemptions) : '',
        startDate: offer.startDate ? new Date(offer.startDate).toISOString().slice(0, 16) : '',
        endDate: offer.endDate ? new Date(offer.endDate).toISOString().slice(0, 16) : '',
        daysOfWeek: Array.isArray(offer.daysOfWeek) ? offer.daysOfWeek.join(',') : '0,1,2,3,4,5,6',
        redemptionCode: offer.redemptionCode ?? '',
        redemptionInstructions: offer.redemptionInstructions ?? '',
      }}
    />
  )
}
