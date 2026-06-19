'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Store,
  Users,
  FileText,
  BarChart3,
  Settings,
  CreditCard,
  ShoppingBag,
  MapPin,
  Gift,
  Building2,
  UserCircle,
  Bell,
  Upload,
  LogOut,
  Zap,
  Sparkles,
  Search,
  RefreshCw,
  Bookmark,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string | number
}

interface SidebarProps {
  userType: 'admin' | 'merchant' | 'company_admin' | 'employee'
  userName?: string
  userEmail?: string
  userRole?: string | null
  onLogout?: () => void
}

const navConfig: Record<string, NavItem[]> = {
  admin: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Action Queue', href: '/admin/action-queue', icon: Zap },
    { label: 'Replacement Reviews', href: '/admin/offers/replacements', icon: RefreshCw },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Merchants', href: '/admin/merchants', icon: Store },
    { label: 'Companies', href: '/admin/companies', icon: Building2 },
    { label: 'Employees', href: '/admin/employees', icon: Users },
    { label: 'CSV Uploads', href: '/admin/csv-uploads', icon: Upload },
    // { label: 'Content', href: '/admin/content', icon: Sparkles },
    // { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: Search },
    { label: 'Billing', href: '/admin/billing', icon: CreditCard },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ],
  merchant: [
    { label: 'Overview', href: '/merchant', icon: LayoutDashboard },
    { label: 'Offers', href: '/merchant/offers', icon: Gift },
    { label: 'Analytics', href: '/merchant/analytics', icon: BarChart3 },
    { label: 'Branches', href: '/merchant/branches', icon: MapPin },
    { label: 'Redemptions', href: '/merchant/redemptions', icon: ShoppingBag },
    { label: 'Issues', href: '/merchant/issues', icon: FileText },
    { label: 'Profile', href: '/merchant/profile', icon: Store },
    { label: 'Settings', href: '/merchant/settings', icon: Settings },
  ],
  company_admin: [
    { label: 'Overview', href: '/company', icon: LayoutDashboard },
    { label: 'Employees', href: '/company/employees', icon: Users },
    // { label: 'Analytics', href: '/company/analytics', icon: BarChart3 },
    { label: 'Billing', href: '/company/billing', icon: CreditCard },
    { label: 'Settings', href: '/company/settings', icon: Settings },
  ],
  employee: [
    { label: 'Home', href: '/employee', icon: LayoutDashboard },
    { label: 'Offers', href: '/employee/offers', icon: Gift },
    { label: 'Saved', href: '/employee/saved', icon: Bookmark },
    { label: 'My Redemptions', href: '/employee/redemptions', icon: ShoppingBag },
    { label: 'Notifications', href: '/employee/notifications', icon: Bell },
    { label: 'Profile', href: '/employee/profile', icon: UserCircle },
    { label: 'Settings', href: '/employee/settings', icon: Settings },
  ],
}

export function Sidebar({ userType, userName, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname()
  const navItems = navConfig[userType] ?? []
  const router = useRouter()
  const logout = async() => {
    try {
      // await fetch('/api/auth/logout', {
      //   method: 'POST',
      // })
     const res = await supabase.auth.signOut()
     console.log('Logout response:', res) 
     router.push('/login')
    } 
    catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <aside className="sticky fixed left-0 top-0 z-40 flex h-dvh w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-6">
        <Gift className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Perks Platform</span>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {userName?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{userName ?? 'NA'}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail ?? 'NA'}</p>
          {userRole && (
            <span className="inline-block mt-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {userRole.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
            {navItems.map((item) => {
                const isActive = pathname === item.href

              return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary demo'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t p-3">
        <Button variant="ghost" onClick={logout} className="w-full justify-start gap-3 text-muted-foreground" asChild>
          <Link href="/login">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Link>
        </Button>
      </div>
    </aside>
  )
}
