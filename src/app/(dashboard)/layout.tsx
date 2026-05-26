'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'

const pageTitles: Record<string, string> = {
  '/admin': 'Admin Overview',
  '/admin/action-queue': 'Action Queue',
  '/admin/merchants': 'Merchants',
  '/admin/companies': 'Companies',
  '/admin/employees': 'Employees',
  '/admin/csv-uploads': 'CSV Uploads',
  '/admin/content': 'Content Management',
  '/admin/reports': 'Reports',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/billing': 'Billing',
  '/admin/settings': 'Settings',
  '/merchant': 'Merchant Overview',
  '/merchant/offers': 'My Offers',
  '/merchant/analytics': 'Analytics',
  '/merchant/branches': 'Branches',
  '/merchant/redemptions': 'Redemptions',
  '/merchant/profile': 'Profile',
  '/merchant/settings': 'Settings',
  '/company': 'Company Overview',
  '/company/employees': 'Employees',
  '/company/analytics': 'Analytics',
  '/company/billing': 'Billing',
  '/company/settings': 'Settings',
  '/employee': 'Available Offers',
  '/employee/redemptions': 'My Redemptions',
  '/employee/profile': 'My Profile',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Determine user type from path
  const userType = pathname.startsWith('/merchant')
    ? 'merchant'
    : pathname.startsWith('/company')
      ? 'company_admin'
      : pathname.startsWith('/employee')
        ? 'employee'
        : 'admin'

  // Find the best matching title
  const title = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] ?? 'Dashboard'

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 -translate-x-full transition-transform md:relative md:translate-x-0',
        sidebarOpen && 'translate-x-0'
      )}>
        <Sidebar
          userType={userType}
          userName="Admin User"
          userEmail="admin@perksplatform.com"
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
