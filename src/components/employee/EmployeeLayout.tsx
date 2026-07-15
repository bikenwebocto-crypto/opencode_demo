'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gift, Bookmark, ShoppingBag, UserCircle, Bell, Settings, BarChart3, Home } from 'lucide-react'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { href: '/employee', label: 'Home', icon: Home },
  { href: '/employee/offers', label: 'Offers', icon: Gift },
  { href: '/employee/saved', label: 'Saved', icon: Bookmark },
  { href: '/employee/redemptions', label: 'My Redemptions', icon: ShoppingBag },
  { href: '/employee/notifications', label: 'Notifications', icon: Bell },
  { href: '/employee/profile', label: 'Profile', icon: UserCircle },
  { href: '/employee/settings', label: 'Settings', icon: Settings },
] as const

interface Props {
  children: React.ReactNode
}

export function EmployeeLayout({ children }: Props) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {children}
    </div>
  )
}
