import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { internalError } from '@/lib/employee-helpers'
import { createAuditLog } from '@/services/audit-log.service'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'

// POST /api/mobile/auth/logout
//
// Validates the Supabase Bearer token via the shared
// `getAuthenticatedMobileEmployee` helper, calls
// `supabase.auth.signOut()` server-side (which invalidates the refresh
// token), and records a MOBILE_LOGOUT audit entry.
//
// Note: cookie clearing is intentionally omitted — the mobile app does
// not use Supabase SSR cookies; the Bearer token is the only transport.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    // Sign out at Supabase — this invalidates the refresh token server-side.
    await supabase.auth.signOut().catch(() => null)

    void createAuditLog({
      actorType: 'employee',
      actorId: auth.employee.id,
      action: 'MOBILE_LOGOUT',
      entityType: 'employee',
      entityId: auth.employee.id,
      metadata: { loginSource: 'mobile' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return internalError(error)
  }
}
