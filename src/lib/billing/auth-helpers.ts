import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { forbidden } from '@/lib/api-auth'
import {
  BILLING_AUDIT_ACTIONS,
  BILLING_AUDIT_ENTITIES,
  isValidBillingTransition,
  type BillingAuditAction,
} from './audit-events'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}

export async function requireAdmin(): Promise<
  | { ok: true; adminId: string | null; userId: string }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, response: unauthorized() }
  if (user.userType !== 'admin') return { ok: false, response: forbidden(user.userType) }
  const adminUser = await prisma.adminUser.findUnique({
    where: { email: user.email },
    select: { id: true },
  })
  return { ok: true, adminId: adminUser?.id ?? null, userId: user.id }
}

export async function writeBillingAudit(opts: {
  action: BillingAuditAction
  companyId: string
  adminId: string | null
  fromStatus?: string
  toStatus?: string
  reason?: string
  metadata?: Record<string, unknown>
}) {
  await prisma.auditLog.create({
    data: {
      actorType: 'admin',
      adminId: opts.adminId,
      companyId: opts.companyId,
      action: opts.action,
      entityType: BILLING_AUDIT_ENTITIES.COMPANY,
      entityId: opts.companyId,
      changes: {
        from: opts.fromStatus ?? null,
        to: opts.toStatus ?? null,
        reason: opts.reason ?? null,
        ...(opts.metadata ?? {}),
      } as any,
    },
  })
}

export async function writeBillingNotification(opts: {
  companyId: string
  adminId: string | null
  title: string
  body: string
  referenceType?: string
  referenceId?: string
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
}) {
  await prisma.notificationEvent.create({
    data: {
      recipientType: 'admin',
      adminId: opts.adminId,
      title: opts.title,
      body: opts.body,
      channel: 'IN_APP',
      priority: opts.priority ?? 'NORMAL',
      referenceType: opts.referenceType ?? 'company_billing',
      referenceId: opts.referenceId ?? opts.companyId,
      sentAt: new Date(),
    },
  })
}

export { BILLING_AUDIT_ACTIONS, isValidBillingTransition }
