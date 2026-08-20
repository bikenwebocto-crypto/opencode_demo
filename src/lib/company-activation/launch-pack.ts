/**
 * Launch Pack + reminder workflows.
 *
 * Uses the centralized NotificationService for all notification creation.
 */

import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/services/audit-log.service'
import { NotificationService } from '@/services/notification.service'

export async function sendLaunchPack(companyId: string, profileId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { companyAdmins: { where: { isActive: true } } },
  })
  if (!company) {
    throw new Error('Company not found')
  }

  // Mark the activation transition with a CompanyStatusHistory entry
  await createAuditLog({
    actorType: 'admin',
    actorId: profileId,
    action: 'LAUNCH_PACK_SENT',
    entityType: 'company',
    entityId: companyId,
    metadata: {
      adminCount: company.companyAdmins.length,
    },
  })

  // Send welcome notifications to company admins
  const adminIds = company.companyAdmins.map((a) => a.id)
  if (adminIds.length > 0) {
    await NotificationService.publish({
      type: 'LAUNCH_PACK',
      recipients: adminIds.map((id) => ({ role: 'company_admin', id })),
      title: `Welcome to ${company.name} on the platform`,
      message: `Your account is ready. Sign in to manage your team and start exploring offers.`,
      priority: 'NORMAL',
      channels: ['IN_APP', 'EMAIL'],
      referenceType: 'launch_pack',
      referenceId: companyId,
    })
  }

  // Send to all active employees
  await NotificationService.publishToEmployees(companyId, {
    type: 'LAUNCH_PACK',
    title: `Welcome to ${company.name} on the platform`,
    message: `Your account is ready. Sign in to view available offers.`,
    priority: 'NORMAL',
    channels: ['IN_APP'],
    referenceType: 'launch_pack',
    referenceId: companyId,
  })

  return {
    adminCount: adminIds.length,
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

  // Send to all company admins
  const adminIds = company.companyAdmins.map((a) => a.id)
  if (adminIds.length > 0) {
    await NotificationService.publish({
      type: 'BILLING_REMINDER',
      recipients: adminIds.map((id) => ({ role: 'company_admin', id })),
      title: `Payment overdue: ${company.name}`,
      message: `Your invoice is overdue. Please settle the balance to avoid service interruption.`,
      priority: 'HIGH',
      channels: ['IN_APP', 'EMAIL'],
      referenceType: 'billing_reminder',
      referenceId: companyId,
    })
  }
}
