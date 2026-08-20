import { SkeletonPageHeader } from '@/components/shared/page-skeletons'
import { SkeletonOfferCards } from '@/components/shared/page-skeletons'
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonOfferCards />
    </div>
  )
}
