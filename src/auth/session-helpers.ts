import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

export type CurrentUser = {
  id: string
  email: string
  role: UserRole
  userType: 'admin' | 'merchant' | 'company_admin' | 'employee'
  companyId: string | null
  profileType: string
  profileId: string
  profile: Record<string, unknown> | null
}

function roleToUserType(role: UserRole): CurrentUser['userType'] {
  if (role === 'admin') return 'admin'
  if (role === 'merchant') return 'merchant'
  if (role === 'company_admin') return 'company_admin'
  return 'employee'
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.email) return null
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return null

    const role = user.role
    const userType = roleToUserType(role)
    let companyId: string | null = null
    let profile: Record<string, unknown> | null = null
    let profileId = user.id

    switch (role) {
      case 'admin': {
        const admin = await prisma.adminUser.findFirst({ where: { email: user.email } })
        if (admin) {
          profile = admin as unknown as Record<string, unknown>
          profileId = admin.id
        }
        break
      }
      case 'merchant': {
        const merchant = await prisma.merchant.findUnique({ where: { email: user.email } })
        if (merchant) {
          profile = merchant as unknown as Record<string, unknown>
          profileId = merchant.id
        }
        break
      }
      case 'company_admin': {
        const ca = await prisma.companyAdmin.findUnique({ where: { email: user.email } })
        if (ca) {
          profile = ca as unknown as Record<string, unknown>
          profileId = ca.id
          companyId = ca.companyId
        }
        break
      }
      case 'employee': {
        const emp = await prisma.employee.findUnique({ where: { email: user.email } })
        if (emp) {
          profile = emp as unknown as Record<string, unknown>
          profileId = emp.id
          companyId = emp.companyId
        }
        break
      }
    }

    return {
      id: user.id,
      email: user.email,
      role,
      userType,
      companyId,
      profileType: role === 'admin' ? 'ADMIN' : role === 'merchant' ? 'MERCHANT' : role === 'company_admin' ? 'COMPANY_ADMIN' : 'EMPLOYEE',
      profileId,
      profile,
    }
  } catch (error) {
    console.error('getCurrentUser error:', error)
    return null
  }
}

export type ResolvedUser = {
  id: string
  email: string
  userType: 'admin' | 'merchant' | 'company_admin' | 'employee'
  role: UserRole | null
  profileId: string | null
  name: string
  isActive: boolean
}

export async function resolveAuthenticatedUser(): Promise<ResolvedUser | null> {
  const session = await getCurrentUser()
  if (!session) return null

  const p = session.profile as { firstName?: string; lastName?: string; businessName?: string } | null
  let name = session.email
  if (p?.businessName) {
    name = p.businessName
  } else if (p?.firstName) {
    name = `${p.firstName} ${p.lastName ?? ''}`.trim()
  }

  return {
    id: session.id,
    email: session.email,
    userType: session.userType,
    role: session.role,
    profileId: session.profileId,
    name: name || 'NA',
    isActive: true,
  }
}
