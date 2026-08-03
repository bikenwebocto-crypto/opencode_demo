'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Loader2 } from 'lucide-react'
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
  Search,
  RefreshCw,
  Bookmark,
  Palette,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { PublicBranding } from '@/features/admin/settings/login-branding/services/login-branding.service'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string | number
  exact?: boolean
}

interface SidebarProps {
  userType: 'admin' | 'merchant' | 'company_admin' | 'employee'
  userName?: string
  userEmail?: string
  userRole?: string | null
  companyName?: string | null
  branding?: PublicBranding | null
  onLogout?: () => void
}

const navConfig: Record<string, NavItem[]> = {
  admin: [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
    { label: 'Action Queue', href: '/admin/action-queue', icon: Zap },
    { label: 'Replacement Reviews', href: '/admin/offers/replacements', icon: RefreshCw },
    { label: 'Recycle Bin', href: '/admin/offers/deleted', icon: Trash2 },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Merchants', href: '/admin/merchants', icon: Store },
    { label: 'Companies', href: '/admin/companies', icon: Building2 },
    { label: 'Employees', href: '/admin/employees', icon: Users },
    { label: 'CSV Uploads', href: '/admin/csv-uploads', icon: Upload },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: Search },
    // { label: 'Billing', href: '/admin/billing', icon: CreditCard },
    { label: 'Complaints', href: '/admin/complaints', icon: FileText },
    { label: 'Banners', href: '/admin/banners', icon: Palette },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
    { label: 'Login Branding', href: '/admin/settings/login-branding', icon: Palette },
  ],
  merchant: [
    { label: 'Overview', href: '/merchant', icon: LayoutDashboard, exact: true },
    { label: 'Offers', href: '/merchant/offers', icon: Gift },
    { label: 'Analytics', href: '/merchant/analytics', icon: BarChart3 },
    { label: 'Branches', href: '/merchant/branches', icon: MapPin },
    { label: 'Redemptions', href: '/merchant/redemptions', icon: ShoppingBag },
    { label: 'Issues', href: '/merchant/issues', icon: FileText },
    { label: 'Complaints', href: '/merchant/complaints', icon: FileText },
    { label: 'Banners', href: '/merchant/banners', icon: Palette },
    { label: 'Profile', href: '/merchant/profile', icon: Store },
    { label: 'Store Map', href: '/merchant/profile/store-map', icon: MapPin },
    { label: 'Settings', href: '/merchant/settings', icon: Settings },
  ],
  company_admin: [
    { label: 'Overview', href: '/company', icon: LayoutDashboard, exact: true },
    { label: 'Employees', href: '/company/employees', icon: Users },
    { label: 'Near Stores', href: '/company/near-stores', icon: MapPin },
    { label: 'Complaints', href: '/company/complaints', icon: FileText },
    { label: 'Analytics', href: '/company/analytics', icon: BarChart3 },
    { label: 'Billing', href: '/company/billing', icon: CreditCard },
    { label: 'Settings', href: '/company/settings', icon: Settings },
  ],
  employee: [
    { label: 'Home', href: '/employee', icon: LayoutDashboard, exact: true },
    { label: 'Offers', href: '/employee/offers', icon: Gift },
    { label: 'Saved', href: '/employee/saved', icon: Bookmark },
    { label: 'Near Stores', href: '/employee/near-stores', icon: MapPin },
    { label: 'Complaints', href: '/employee/complaints', icon: FileText },
    { label: 'My Redemptions', href: '/employee/redemptions', icon: ShoppingBag },
    { label: 'Notifications', href: '/employee/notifications', icon: Bell },
    { label: 'Profile', href: '/employee/profile', icon: UserCircle },
    { label: 'Settings', href: '/employee/settings', icon: Settings },
  ],
}

export function Sidebar({ userType, userName, userEmail, userRole, companyName, branding }: SidebarProps) {
  const pathname = usePathname()
  const navItems = navConfig[userType] ?? []
  const router = useRouter()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const displayName = userName
  const initials = displayName?.charAt(0)?.toUpperCase() ?? 'U'

  useEffect(() => {
    setNavigatingTo(null)
  }, [pathname])

  const handleNavClick = useCallback((href: string) => {
    if (pathname !== href) {
      setNavigatingTo(href)
    }
  }, [pathname])

  const [signingOut, setSigningOut] = useState(false)

  const logout = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      setSigningOut(false)
    }
  }

  return (
    <aside className="sticky fixed left-0 top-0 z-40 flex h-dvh w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="relative flex h-14 items-center gap-2 border-b px-6">
        <img
          src={branding?.logoUrl ?? '/logo.png'}
          alt=""
          className="p-2 pointer-events-none absolute inset-0 h-full select-none object-content"
        />
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {initials}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{displayName ?? 'NA'}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail ?? 'NA'}</p>
          {companyName && (
            <p className="truncate text-xs text-muted-foreground">{companyName}</p>
          )}
          {userRole && (
            <span className="mt-0.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {userRole.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + '/'))
            const isLoading = navigatingTo === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                  {!isLoading && item.badge && (
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
        <LoadingButton variant="ghost" onClick={logout} loading={signingOut} loadingText="Signing out..." className="w-full justify-start gap-3 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          Sign Out
        </LoadingButton>
      </div>
    </aside>
  )
}
