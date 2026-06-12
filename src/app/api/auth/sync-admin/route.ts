import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const dashboardMap: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  MERCHANT: '/merchant',
  COMPANY_ADMIN: '/company',
  EMPLOYEE: '/employee',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const { data: { user }, error } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const email = user.email!

  // ── Step 1: Check existing Account ──────────────────────
  const existingAccount = await prisma.account.findUnique({
    where: { authUserId: user.id },
  })
  
  if (existingAccount) {
    if (existingAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Account is inactive or suspended.',
          },
        },
        { status: 403 },
      )
    }

    await prisma.account.update({
      where: { authUserId: user.id },
      data: { lastLoginAt: new Date() },
    })

    const redirectTo = dashboardMap[existingAccount.role] ?? '/employee'

    return NextResponse.json({
      success: true,
      role: existingAccount.role,
      redirectTo,
    })
  }

  // ── Step 2: No Account — discover profile by email ──────
  const [adminUser, merchant, companyAdmin, employee] = await Promise.all([
    prisma.adminUser.findUnique({ where: { email }, select: { id: true } }),
    prisma.merchant.findUnique({ where: { email }, select: { id: true } }),
    prisma.companyAdmin.findUnique({ where: { email }, select: { id: true } }),
    prisma.employee.findUnique({ where: { email }, select: { id: true } }),
  ])

  const matches: { role: string; profileId: string; profileType: string }[] = []
  if (adminUser) matches.push({ role: 'SUPER_ADMIN', profileId: adminUser.id, profileType: 'ADMIN_USER' })
  if (merchant) matches.push({ role: 'MERCHANT', profileId: merchant.id, profileType: 'MERCHANT' })
  if (companyAdmin) matches.push({ role: 'COMPANY_ADMIN', profileId: companyAdmin.id, profileType: 'COMPANY' })
  if (employee) matches.push({ role: 'EMPLOYEE', profileId: employee.id, profileType: 'EMPLOYEE' })


  if (matches.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_NOT_MAPPED',
          message: 'You are not mapped to any role or account. Please contact your administrator.',
        },
      },
      { status: 403 },
    )
  }

  if (matches.length > 1) {
    console.error(
      `[SECURITY] User ${email} (${user.id}) is mapped to multiple profiles: ${matches.map((m) => m.role).join(', ')}`,
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MULTIPLE_ROLE_ASSIGNMENTS',
          message: 'User is mapped to multiple profiles. Contact support.',
        },
      },
      { status: 409 },
    )
  }

  // ── Step 3: Exactly one match — create Account ──────────
  const match = matches[0]!

  const account = await prisma.account.create({
    data: {
      authUserId: user.id,
      email,
      role: match.role as any,
      profileId: match.profileId,
      profileType: match.profileType as any,
      status: 'ACTIVE',
    },
  })

  const redirectTo = dashboardMap[account.role] ?? '/employee'

  return NextResponse.json({
    success: true,
    role: account.role,
    redirectTo,
  })
}
