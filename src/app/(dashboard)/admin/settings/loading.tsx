import { SkeletonPageHeader } from '@/components/shared/page-skeletons'
import { SkeletonForm } from '@/components/shared/page-skeletons'
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader hasDescription={false} />
      <SkeletonForm fields={5} />
    </div>
  )
}
