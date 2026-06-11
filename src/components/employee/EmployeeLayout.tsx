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
      <nav className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1 text-sm">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/employee' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
