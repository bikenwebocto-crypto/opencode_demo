import { prisma } from '@/lib/prisma'
import type { AuthContext, AuthResult, Role, ProfileType, AuthProfile } from './types'

const roleMap: Record<string, Role> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  MERCHANT: 'MERCHANT',
  EMPLOYEE: 'EMPLOYEE',
}

const profileTypeMap: Record<string, ProfileType> = {
  ADMIN: 'ADMIN',
  COMPANY: 'COMPANY',
  MERCHANT: 'MERCHANT',
  EMPLOYEE: 'EMPLOYEE',
}

export async function buildAuthContext(auth: AuthResult): Promise<AuthContext> {
  const account = await prisma.account.findUnique({
    where: { email: auth.user.email! },
  })
  if (!account || account.status !== 'ACTIVE') {
    throw new Error('Account not found or inactive')
  }

  const role = roleMap[account.role] ?? 'EMPLOYEE'
  const profileType = profileTypeMap[account.profileType] ?? 'EMPLOYEE'

  let profile: AuthProfile = null
  let profileId: string | null = null
  let companyId: string | null = null
  let company: any = null

  switch (profileType) {
    case 'ADMIN': {
      const p = await prisma.adminUser.findFirst({ where: { accountId: account.authUserId } })
      profile = p
      profileId = p?.id ?? null
      break
    }
    case 'MERCHANT': {
      const p = await prisma.merchant.findFirst({ where: { accountId: account.authUserId } })
      profile = p
      profileId = p?.id ?? null
      break
    }
    case 'COMPANY': {
      const p = await prisma.companyAdmin.findFirst({ where: { accountId: account.authUserId } })
      profile = p
      profileId = p?.id ?? null
      companyId = p?.companyId ?? null
      if (companyId) {
        company = await prisma.company.findUnique({ where: { id: companyId } })
      }
      break
    }
    case 'EMPLOYEE': {
      const p = await prisma.employee.findFirst({ where: { accountId: account.authUserId } })
      profile = p
      profileId = p?.id ?? null
      companyId = p?.companyId ?? null
      if (companyId) {
        company = await prisma.company.findUnique({ where: { id: companyId } })
      }
      break
    }
  }

  return {
    user: auth.user,
    accessToken: auth.accessToken,
    account,
    role,
    profileType,
    profileId,
    profile,
    companyId,
    company,
    isActive: account.status === 'ACTIVE',
    accountStatus: account.status,
    profileStatus: (profile as any)?.status ?? null,
    companyStatus: company?.status ?? null,
  }
}
