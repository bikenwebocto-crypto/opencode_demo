import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email/email'
import type { NotificationType } from '@/types/notification'
import type { NotificationChannel, NotificationPriority, NotificationEvent } from '@prisma/client'
import { PushService } from './push.service'

// ============================================================
// RECIPIENT TYPES
// ============================================================

export type RecipientRole = 'admin' | 'merchant' | 'company_admin' | 'employee'

export interface Recipient {
  role: RecipientRole
  id: string
}

// ============================================================
// PUBLISH OPTIONS
// ============================================================

export interface PublishNotificationOptions {
  type: NotificationType
  recipients: Recipient[]
  title: string
  message?: string
  priority?: NotificationPriority
  channels?: NotificationChannel[]
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}

// ============================================================
// PREFERENCES
// ============================================================

export interface NotificationPreferenceRecord {
  id: string
  userId: string
  role: RecipientRole
  notificationType: string
  enableInApp: boolean
  enableEmail: boolean
  enablePush: boolean
  enableSms: boolean
}

// ============================================================
// NOTIFICATION SERVICE
// ============================================================

class NotificationServiceClass {
  /**
   * Publish a notification to one or more recipients.
   * This is the single entry point for all notification creation.
   */
  async publish(options: PublishNotificationOptions): Promise<NotificationEvent[]> {
    const {
      type,
      recipients,
      title,
      message,
      priority = 'NORMAL',
      channels = ['IN_APP'],
      referenceType,
      referenceId,
      metadata,
    } = options

    if (!recipients.length) return []

    const createdNotifications: NotificationEvent[] = []

    // Group recipients by role for batch processing
    const grouped = this.groupRecipients(recipients)

    for (const [role, ids] of Object.entries(grouped)) {
      const notifications = await this.createForRole(
        role as RecipientRole,
        ids,
        { type, title, message, priority, channels, referenceType, referenceId }
      )
      createdNotifications.push(...notifications)
    }

    // Dispatch emails asynchronously (non-blocking)
    if (channels.includes('EMAIL')) {
      this.dispatchEmails(createdNotifications, recipients).catch((err) => {
        console.error('[NotificationService] Email dispatch failed:', err)
      })
    }

    if (channels.includes('PUSH')) {
      console.log('[NotificationService] Starting push delivery', {
        type,
        recipientCount: recipients.length,
        title,
      })
      void PushService.sendToRecipients(recipients, {
        title,
        body: message,
        data: {
          notificationType: type,
          ...(referenceType ? { referenceType } : {}),
          ...(referenceId ? { referenceId } : {}),
          ...this.stringifyMetadata(metadata),
        },
      }).then((result) => {
        console.log('[NotificationService] Push delivery result', {
          type,
          ...result,
        })
        if (result.failed > 0) {
          console.error('[NotificationService] Push delivery partially failed:', result)
        }
      }).catch((err) => {
        console.error('[NotificationService] Push delivery failed:', err)
      })
    }

    return createdNotifications
  }

  /**
   * Publish to all active admins.
   */
  async publishToAdmins(options: Omit<PublishNotificationOptions, 'recipients'>): Promise<NotificationEvent[]> {
    const admins = await prisma.adminUser.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    return this.publish({
      ...options,
      recipients: admins.map((a) => ({ role: 'admin', id: a.id })),
    })
  }

  /**
   * Publish to a specific merchant.
   */
  async publishToMerchant(
    merchantId: string,
    options: Omit<PublishNotificationOptions, 'recipients'>
  ): Promise<NotificationEvent[]> {
    return this.publish({
      ...options,
      recipients: [{ role: 'merchant', id: merchantId }],
    })
  }

  /**
   * Publish to all active company admins.
   */
  async publishToCompanyAdmins(
    companyId: string,
    options: Omit<PublishNotificationOptions, 'recipients'>
  ): Promise<NotificationEvent[]> {
    const admins = await prisma.companyAdmin.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    })
    return this.publish({
      ...options,
      recipients: admins.map((a) => ({ role: 'company_admin', id: a.id })),
    })
  }

  /**
   * Publish to all active employees of a company.
   */
  async publishToEmployees(
    companyId: string,
    options: Omit<PublishNotificationOptions, 'recipients'>
  ): Promise<NotificationEvent[]> {
    const employees = await prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })
    return this.publish({
      ...options,
      recipients: employees.map((e) => ({ role: 'employee', id: e.id })),
    })
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  private groupRecipients(recipients: Recipient[]): Record<RecipientRole, string[]> {
    const grouped: Record<RecipientRole, string[]> = {
      admin: [],
      merchant: [],
      company_admin: [],
      employee: [],
    }
    for (const r of recipients) {
      grouped[r.role].push(r.id)
    }
    return grouped
  }

  private async createForRole(
    role: RecipientRole,
    ids: string[],
    data: {
      type: NotificationType
      title: string
      message?: string
      priority: NotificationPriority
      channels: NotificationChannel[]
      referenceType?: string
      referenceId?: string
    }
  ): Promise<NotificationEvent[]> {
    if (!ids.length) return []

    const foreignKey = this.getForeignKeyField(role)
    let targetIds = ids
    if (data.referenceId) {
      const existing = await prisma.notificationEvent.findMany({
        where: {
          referenceType: data.referenceType ?? data.type,
          referenceId: data.referenceId,
          title: data.title,
          OR: ids.map((id) => ({ [foreignKey]: id })),
        },
        select: { [foreignKey]: true } as any,
      })
      const existingIds = new Set(existing.map((row) => (row as any)[foreignKey]))
      targetIds = ids.filter((id) => !existingIds.has(id))
    }
    if (!targetIds.length) return []

    const now = new Date()
    const primaryChannel = data.channels[0] ?? 'IN_APP'

    // Build batch insert payloads
    const payloads = targetIds.map((id) => {
      const fkField = foreignKey
      return {
        recipientType: role,
        [fkField]: id,
        title: data.title,
        body: data.message ?? null,
        channel: primaryChannel,
        priority: data.priority,
        referenceType: data.referenceType ?? data.type,
        referenceId: data.referenceId ?? null,
        isRead: false,
        sentAt: now,
      }
    })

    // Batch insert using createMany for performance
    const result = await prisma.notificationEvent.createMany({
      data: payloads,
      skipDuplicates: true,
    })

    // Fetch created records (createMany doesn't return them)
    // Use a findMany with the same conditions
    const created = await prisma.notificationEvent.findMany({
      where: {
        referenceType: data.referenceType ?? data.type,
        referenceId: data.referenceId ?? null,
        createdAt: { gte: new Date(now.getTime() - 1000) },
        OR: ids.map((id) => ({
          [foreignKey]: id,
        })),
      },
      orderBy: { createdAt: 'desc' },
      take: targetIds.length,
    })

    return created
  }

  private getForeignKeyField(role: RecipientRole): string {
    const map: Record<RecipientRole, string> = {
      admin: 'adminId',
      merchant: 'merchantId',
      company_admin: 'companyAdminId',
      employee: 'employeeId',
    }
    return map[role]
  }

  private async dispatchEmails(
    notifications: NotificationEvent[],
    recipients: Recipient[]
  ): Promise<void> {
    // Deduplicate recipients
    const uniqueRecipients = [...new Map(recipients.map((r) => [`${r.role}:${r.id}`, r])).values()]

    for (const recipient of uniqueRecipients) {
      const notification = notifications.find((n) => {
        const fkField = this.getForeignKeyField(recipient.role)
        return (n as any)[fkField] === recipient.id
      })
      if (!notification) continue

      // Look up email
      const email = await this.lookupEmail(recipient)
      if (!email) continue

      // Send email
      await emailService.sendEmail({
        to: email,
        subject: notification.title,
        html: this.buildEmailHtml(notification),
      })

      // Mark as delivered
      await prisma.notificationEvent.update({
        where: { id: notification.id },
        data: { deliveredAt: new Date() },
      })
    }
  }

  private async lookupEmail(recipient: Recipient): Promise<string | null> {
    try {
      const fkField = this.getForeignKeyField(recipient.role)
      const profileModel = this.getProfileModel(recipient.role)

      const profile = await (prisma as any)[profileModel].findUnique({
        where: { id: recipient.id },
        select: { accountId: true },
      })
      if (!profile?.accountId) return null

      const account = await prisma.account.findUnique({
        where: { authUserId: profile.accountId },
        select: { email: true },
      })
      return account?.email ?? null
    } catch {
      return null
    }
  }

  private getProfileModel(role: RecipientRole): string {
    const map: Record<RecipientRole, string> = {
      admin: 'adminUser',
      merchant: 'merchant',
      company_admin: 'companyAdmin',
      employee: 'employee',
    }
    return map[role]
  }

  private buildEmailHtml(notification: NotificationEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8fafc; border-radius: 8px; padding: 24px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1e293b; margin: 0 0 12px;">${notification.title}</h2>
          ${notification.body ? `<p style="color: #475569; line-height: 1.6; margin: 0;">${notification.body}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Priority: ${notification.priority} · ${new Date(notification.createdAt).toLocaleDateString()}
          </p>
        </div>
      </body>
      </html>
    `
  }

  private stringifyMetadata(metadata?: Record<string, unknown>): Record<string, string> {
    if (!metadata) return {}
    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ])
    )
  }
}

export const NotificationService = new NotificationServiceClass()
