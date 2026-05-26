'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Gift, Tag, Percent, MapPin, ShoppingBag, TrendingUp, Star } from 'lucide-react'

export default function EmployeeOffersPage() {
  const offers = [
    {
      merchant: "Pizza Palace",
      logo: "P",
      title: "20% Off All Menu Items",
      type: "Percentage",
      value: "20% OFF",
      expires: "Dec 31, 2026",
      savings: "$5 avg savings",
      branches: "3 locations",
      rating: 4.8,
      color: "bg-orange-100 text-orange-700",
    },
    {
      merchant: "Coffee House",
      logo: "C",
      title: "Buy 1 Get 1 Free",
      type: "BOGO",
      value: "BOGO",
      expires: "Jan 15, 2026",
      savings: "$4.50 avg savings",
      branches: "2 locations",
      rating: 4.9,
      color: "bg-amber-100 text-amber-700",
    },
    {
      merchant: "Bookworm Store",
      logo: "B",
      title: "$10 Off Any Purchase Over $50",
      type: "Fixed",
      value: "$10 OFF",
      expires: "Feb 28, 2026",
      savings: "$10 avg savings",
      branches: "1 location",
      rating: 4.7,
      color: "bg-indigo-100 text-indigo-700",
    },
    {
      merchant: "FitLife Gym",
      logo: "F",
      title: "25% Off Monthly Membership",
      type: "Percentage",
      value: "25% OFF",
      expires: "Mar 1, 2026",
      savings: "$30 avg savings",
      branches: "All locations",
      rating: 4.6,
      color: "bg-green-100 text-green-700",
    },
    {
      merchant: "TechGadgets Pro",
      logo: "T",
      title: "Flat 15% Off Accessories",
      type: "Percentage",
      value: "15% OFF",
      expires: "Dec 15, 2026",
      savings: "$12 avg savings",
      branches: "Online",
      rating: 4.5,
      color: "bg-blue-100 text-blue-700",
    },
  ]

  // User savings stats
  const stats = [
    { label: 'My Redemptions', value: '18', icon: ShoppingBag },
    { label: 'Total Saved', value: '$124.50', icon: TrendingUp },
    { label: 'Active Offers', value: '5', icon: Gift },
  ]

  return (
    <div className="space-y-6">
      {/* User stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Offer cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Available Offers</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer, i) => (
            <Card key={i} className="relative overflow-hidden transition-shadow hover:shadow-md">
              {/* Discount badge */}
              <div className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${offer.color}`}>
                {offer.value}
              </div>

              <CardContent className="p-4">
                {/* Merchant info */}
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${offer.color} text-sm font-bold`}>
                    {offer.logo}
                  </div>
                  <div>
                    <p className="font-semibold">{offer.merchant}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {offer.rating}
                      <span className="ml-1">·</span>
                      <MapPin className="h-3 w-3" />
                      {offer.branches}
                    </div>
                  </div>
                </div>

                {/* Offer details */}
                <p className="mb-2 text-sm font-medium">{offer.title}</p>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="secondary">{offer.type}</Badge>
                  <span className="text-xs text-muted-foreground">{offer.savings}</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">Expires {offer.expires}</span>
                  <Button size="sm">
                    <Tag className="mr-1 h-3 w-3" /> Redeem
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
