'use client'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface MerchantRow {
  id: string
  name: string
  email: string
  status: string
  category: string
  totalOffers: number
  totalRedemptions: number
  rating: number
  joinedAt: string
}

interface MerchantTableProps {
  merchants: MerchantRow[]
  isLoading?: boolean
  onRowClick?: (merchant: MerchantRow) => void
}

export function MerchantTable({ merchants, isLoading, onRowClick }: MerchantTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }
  if (merchants.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No merchants found</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 font-medium">Merchant</th>
            <th className="pb-3 font-medium">Category</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 text-center font-medium">Offers</th>
            <th className="pb-3 text-center font-medium">Redemptions</th>
            <th className="pb-3 text-center font-medium">Rating</th>
            <th className="pb-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {merchants.map((m) => (
            <tr
              key={m.id}
              className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
              onClick={() => onRowClick?.(m)}
            >
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{m.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3">{m.category}</td>
              <td className="py-3"><StatusBadge status={m.status} /></td>
              <td className="py-3 text-center">{m.totalOffers}</td>
              <td className="py-3 text-center">{m.totalRedemptions}</td>
              <td className="py-3 text-center">{m.rating.toFixed(1)} ★</td>
              <td className="py-3 text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
