import { NextResponse } from 'next/server'
import { getCurrentUser, type CurrentUser } from '@/lib/supabase/server'
import type { UserType } from '@/types'

const ROLE_DASHBOARD: Record<UserType, string> = {
  admin: '/admin',
  merchant: '/merchant',
  company_admin: '/company',
  employee: '/employee',
}

export function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}

export function forbidden(actualRole?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
        actualRole: actualRole ?? null,
        redirectTo: actualRole ? ROLE_DASHBOARD[actualRole as UserType] ?? '/login' : null,
      },
    },
    { status: 403 },
  )
}

export type RequiredRoles = UserType | UserType[]

export async function requireRole(
  required: RequiredRoles
): Promise<{ user: CurrentUser } | NextResponse> {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const allowed = Array.isArray(required) ? required : [required]
  if (!allowed.includes(user.userType as UserType)) {
    return forbidden(user.userType)
  }
  return { user }
}
