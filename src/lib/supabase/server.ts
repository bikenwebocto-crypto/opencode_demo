import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { Database } from './types';

export async function createClient() {
  const cookieStore = await cookies() 

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet : { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export type UserProfile =
  | (import('@prisma/client').AdminUser & { companyId?: null })
  | (import('@prisma/client').Merchant & { companyId?: null })
  | (import('@prisma/client').CompanyAdmin)
  | (import('@prisma/client').Employee);

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  userType: 'admin' | 'merchant' | 'company_admin' | 'employee';
  companyId: string | null;
  profileType: string;
  profileId: string;
  profile: Record<string, unknown> | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const account = await prisma.account.findUnique({
      where: { authUserId: user.id },
    })
    if (!account) return null
    if (account.status !== 'ACTIVE') return null

    const userTypeMap: Record<string, 'admin' | 'merchant' | 'company_admin' | 'employee'> = {
      SUPER_ADMIN: 'admin',
      MERCHANT: 'merchant',
      COMPANY_ADMIN: 'company_admin',
      EMPLOYEE: 'employee',
    }

    const userType = userTypeMap[account.role] ?? 'employee'
    let companyId: string | null = null
    let profile: Record<string, unknown> | null = null

    switch (account.profileType) {
      case 'ADMIN': {
        profile = await prisma.adminUser.findUnique({ where: { id: account.profileId } }) as Record<string, unknown> | null
        companyId = null
        break
      }
      case 'MERCHANT': {
        profile = await prisma.merchant.findUnique({ where: { id: account.profileId } }) as Record<string, unknown> | null
        companyId = null
        break
      }
      case 'COMPANY': {
        const p = await prisma.companyAdmin.findUnique({ where: { id: account.profileId } })
        profile = p as Record<string, unknown> | null
        companyId = p?.companyId ?? null
        break
      }
      case 'EMPLOYEE': {
        const p = await prisma.employee.findUnique({ where: { id: account.profileId } })
        profile = p as Record<string, unknown> | null
        companyId = p?.companyId ?? null
        break
      }
    }

    return {
      id: user.id,
      email: user.email!,
      role: account.role,
      userType,
      companyId,
      profileType: account.profileType,
      profileId: account.profileId,
      profile,
    }
  } catch (error) {
    console.error('getCurrentUser error:', error)
    return null
  }
}

export interface ResolvedUser {
  id: string;
  email: string;
  userType: 'admin' | 'merchant' | 'company_admin' | 'employee';
  role: string | null;
  profileId: string | null;
  name: string;
  isActive: boolean;
}

export async function resolveAuthenticatedUser(): Promise<ResolvedUser | null> {
  const session = await getCurrentUser()
  if (!session) return null

  let name = session.email

  if (session.profile) {
    switch (session.profileType) {
      case 'ADMIN': {
        const p = session.profile as { firstName?: string; lastName?: string }
        if (p.firstName) name = `${p.firstName} ${p.lastName ?? ''}`.trim()
        break
      }
      case 'MERCHANT': {
        const p = session.profile as { businessName?: string }
        if (p.businessName) name = p.businessName
        break
      }
      case 'COMPANY_ADMIN':
      case 'EMPLOYEE': {
        const p = session.profile as { firstName?: string; lastName?: string }
        if (p.firstName) name = `${p.firstName} ${p.lastName ?? ''}`.trim()
        break
      }
    }
  }

  return {
    id: session.id,
    email: session.email,
    userType: session.userType,
    role: session.role,
    profileId: session.profileId,
    name: name || 'NA',
    isActive: session.role !== null && session.role !== undefined,
  }
}
