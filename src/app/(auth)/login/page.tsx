import { getPublicBranding } from '@/features/admin/settings/login-branding/services/login-branding.service'
import { LoginClient } from './login-client'

export default async function LoginPage() {
  const branding = await getPublicBranding()

  return <LoginClient branding={branding} />
}
