import { NextResponse } from 'next/server'
import { buildBillingSummary } from '@/lib/billing/summary'
import { requireAdmin } from '@/lib/billing/auth-helpers'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    const summary = await buildBillingSummary()
    return NextResponse.json({ success: true, data: summary })
  } catch (err) {
    console.error('Billing summary error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
