import { getPublicBranding } from '@/features/admin/settings/login-branding/services/login-branding.service'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const branding = await getPublicBranding()
  return (
    <DashboardShell branding={branding}>
      {children}
    </DashboardShell>
  )
}
