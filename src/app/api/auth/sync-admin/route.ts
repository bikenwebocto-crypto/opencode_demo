import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

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

  const firstName =
    user.user_metadata?.full_name?.split(' ')[0] ??
    user.user_metadata?.name?.split(' ')[0] ??
    'Admin'
  const lastName =
    user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ??
    user.user_metadata?.name?.split(' ').slice(1).join(' ') ??
    ''

  const admin = await prisma.adminUser.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email!,
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
      passwordHash: 'SUPABASE_AUTH',
      isActive: true,
    },
    update: {
      email: user.email!,
      firstName,
      lastName,
    },
  })

  return NextResponse.json({ success: true, admin })
}
