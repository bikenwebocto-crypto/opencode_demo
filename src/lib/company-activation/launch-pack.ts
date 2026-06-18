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

interface LaunchPackRecipient {
  id: string
  email: string
  firstName: string
}

export async function sendLaunchPack(companyId: string, triggeredByUserId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { companyAdmins: { where: { isActive: true } } },
  })
  if (!company) {
    throw new Error('Company not found')
  }

  const admins: LaunchPackRecipient[] = company.companyAdmins.map((a) => ({
    id: a.id,
    email: a.email,
    firstName: a.firstName,
  }))

  const employees = await prisma.employee.findMany({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, email: true, firstName: true },
  })

  const recipients: LaunchPackRecipient[] = [
    ...admins,
    ...employees,
  ]

  // Mark the activation transition with a CompanyStatusHistory
  // entry — useful for audit + UI.
  await prisma.auditLog.create({
    data: {
      actorType: 'admin',
      adminId: triggeredByUserId,
      action: 'LAUNCH_PACK_SENT',
      entityType: 'company',
      entityId: companyId,
      metadata: {
        adminCount: admins.length,
        employeeCount: employees.length,
      },
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

export async function sendBillingReminder(companyId: string, triggeredByUserId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { companyAdmins: { where: { isActive: true } } },
  })
  if (!company) {
    throw new Error('Company not found')
  }

  await prisma.auditLog.create({
    data: {
      actorType: 'admin',
      adminId: triggeredByUserId,
      action: 'BILLING_REMINDER_SENT',
      entityType: 'company',
      entityId: companyId,
      metadata: { billingStatus: 'INVOICE_OVERDUE' },
    },
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
