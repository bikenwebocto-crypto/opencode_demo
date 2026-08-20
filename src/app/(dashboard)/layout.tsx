import { getPublicBranding } from '@/features/admin/settings/login-branding/services/login-branding.service'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { getActiveTheme, generateThemeCssVars } from '@/lib/theme'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [branding, themeSettings] = await Promise.all([
    getPublicBranding(),
    getActiveTheme(),
  ])
  const themeVars = generateThemeCssVars(themeSettings)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeVars} }` }} />
      <DashboardShell branding={branding}>
        {children}
      </DashboardShell>
    </>
  )
}
