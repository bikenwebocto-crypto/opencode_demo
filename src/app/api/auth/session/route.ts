import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()

  const cookieStore = await cookies()

  cookieStore.set('sb-access-token', body.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  cookieStore.set('sb-refresh-token', body.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  console.log('Session tokens stored in cookies',cookieStore.get('sb-access-token'), cookieStore.get('sb-refresh-token'))
  return NextResponse.json({
    success: true,
  })
}