/**
 * Launch Pack + reminder workflows.
 *
 * On Company status -> ACTIVE, we:
 *   1. Mark the company admin's first welcome as queued
 *   2. Queue onboarding notifications for all active employees
 *
 * On BillingStatus -> INVOICE_OVERDUE, we queue a reminder for the
 * CompanyAdmin. The existing QueueWorker in src/lib/queue/worker.ts
 * processes the "notification.send" event type — we reuse it.
 *
 * The actual email transport is intentionally out of scope: this
 * project has NotificationEvent (in-app) and a queue worker that
 * drains pending sends. We do not create duplicate email services
 * per the task instructions.
 */

import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/services/audit-log.service'

interface LaunchPackRecipient {
  id: string
  email: string
  firstName: string
}

export async function sendLaunchPack(companyId: string, profileId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { companyAdmins: { where: { isActive: true } } },
  })
  if (!company) {
    throw new Error('Company not found')
  }

  const adminAccountIds = company.companyAdmins.map((a) => a.accountId).filter(Boolean) as string[]
  const adminAccounts = adminAccountIds.length > 0
    ? await prisma.account.findMany({ where: { authUserId: { in: adminAccountIds } }, select: { authUserId: true, email: true } })
    : []
  const adminEmailMap = new Map(adminAccounts.map((a) => [a.authUserId, a.email]))

  const admins: LaunchPackRecipient[] = company.companyAdmins.map((a) => ({
    id: a.id,
    email: adminEmailMap.get(a.accountId ?? '') ?? '',
    firstName: a.firstName,
  }))

  const employees = await prisma.employee.findMany({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, firstName: true, accountId: true },
  })

  const employeeAccountIds = employees.map((e) => e.accountId).filter(Boolean) as string[]
  const employeeAccounts = employeeAccountIds.length > 0
    ? await prisma.account.findMany({ where: { authUserId: { in: employeeAccountIds } }, select: { authUserId: true, email: true } })
    : []
  const employeeEmailMap = new Map(employeeAccounts.map((a) => [a.authUserId, a.email]))

  const recipients: LaunchPackRecipient[] = [
    ...admins,
    ...employees.map((e) => ({
      id: e.id,
      email: employeeEmailMap.get(e.accountId ?? '') ?? '',
      firstName: e.firstName,
    })),
  ]

  // Mark the activation transition with a CompanyStatusHistory
  // entry — useful for audit + UI.
  await createAuditLog({
    actorType: 'admin',
    actorId: profileId,
    action: 'LAUNCH_PACK_SENT',
    entityType: 'company',
    entityId: companyId,
    metadata: {
      adminCount: admins.length,
      employeeCount: employees.length,
    },
  })

  for (const r of recipients) {
    await prisma.notificationEvent.create({
      data: {
        recipientType: 'company_admin',
        companyAdminId: r.id,
        title: `Welcome to ${company.name} on the platform`,
        body: `Your account is ready. Sign in to manage your team and start exploring offers.`,
        channel: 'EMAIL',
        priority: 'NORMAL',
        referenceType: 'launch_pack',
        referenceId: companyId,
        sentAt: new Date(),
      },
    })
  }

  return {
    adminCount: admins.length,
    employeeCount: employees.length,
  }
}

export async function sendBillingReminder(companyId: string, profileId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { companyAdmins: { where: { isActive: true } } },
  })
  if (!company) {
    throw new Error('Company not found')
  }

  await createAuditLog({
    actorType: 'admin',
    actorId: profileId,
    action: 'BILLING_REMINDER_SENT',
    entityType: 'company',
    entityId: companyId,
    metadata: { billingStatus: 'INVOICE_OVERDUE' },
  })

  for (const a of company.companyAdmins) {
    await prisma.notificationEvent.create({
      data: {
        recipientType: 'company_admin',
        companyAdminId: a.id,
        title: `Payment overdue: ${company.name}`,
        body: `Your invoice is overdue. Please settle the balance to avoid service interruption.`,
        channel: 'EMAIL',
        priority: 'HIGH',
        referenceType: 'billing_reminder',
        referenceId: companyId,
        sentAt: new Date(),
      },
    })
  }
}
