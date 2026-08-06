import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const senderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? ''
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
    const appIdPrefixMatch = appId.startsWith(`1:${senderId}:web:`)

    return NextResponse.json({
      success: true,
      admin: {
        projectId: process.env.FIREBASE_PROJECT_ID ?? null,
        credentialConfigured: Boolean(
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY
        ),
      },
      web: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
        messagingSenderId: senderId || null,
        appId: appId || null,
        appIdPrefixMatchesSenderId: appIdPrefixMatch,
      },
      checks: {
        adminAndWebProjectMatch: process.env.FIREBASE_PROJECT_ID === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      note: 'Verify in Firebase Console > Project settings > Cloud Messaging that the sender ID matches the admin project. If not, replace NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID/APP_ID/VAPID_KEY with the values from that project, then re-register the browser token.',
    })
  } catch (error) {
    console.error('[Notifications Diagnostics]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
