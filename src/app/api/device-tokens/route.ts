import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokens = await prisma.deviceToken.findMany({
      where: {
        userId: user.id,
        role: user.userType,
        enabled: true,
      },
      orderBy: { lastSeen: 'desc' },
    })

    return NextResponse.json({ success: true, data: tokens })
  } catch (error) {
    console.error('[Device Tokens GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { token, platform = 'web', deviceId } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Upsert: update if exists, create if not
    const existing = await prisma.deviceToken.findUnique({
      where: { token },
    })

    if (existing) {
      await prisma.deviceToken.update({
        where: { token },
        data: {
          userId: user.id,
          role: user.userType,
          lastSeen: new Date(),
          enabled: true,
        },
      })
    } else {
      await prisma.deviceToken.create({
        data: {
          userId: user.id,
          role: user.userType,
          token,
          platform,
          deviceId: deviceId ?? null,
          enabled: true,
          lastSeen: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Device Token POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    await prisma.deviceToken.updateMany({
      where: { token, userId: user.id },
      data: { enabled: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Device Token DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
