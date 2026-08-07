import { prisma } from '@/lib/prisma'
import { getFirebaseAdminMessaging } from '@/lib/firebase-admin'
import type { Recipient } from './notification.service'
import type { Messaging, MulticastMessage } from 'firebase-admin/messaging'

const MAX_BATCH_SIZE = 500
const MAX_ATTEMPTS = 3

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

const RETRYABLE_CODES = new Set([
  'messaging/quota-exceeded',
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/unknown-error',
])

const CREDENTIAL_ERROR_CODES = new Set(['messaging/mismatched-credential'])

export interface PushPayload {
  title: string
  body?: string
  data?: Record<string, string>
}

export interface PushDeliveryResult {
  attempted: number
  successful: number
  failed: number
  removedTokens: number
  errors: Array<{ code: string; count: number }>
}

export class PushServiceClass {
  async sendToRecipients(recipients: Recipient[], payload: PushPayload): Promise<PushDeliveryResult> {
    const result: PushDeliveryResult = {
      attempted: 0,
      successful: 0,
      failed: 0,
      removedTokens: 0,
      errors: [],
    }

    if (!recipients.length) return result

    const tokens = await this.loadTokens(recipients)
    console.log('[PushService] Loaded tokens for recipients', {
      token: tokens,
    })
    if (!tokens.length) return result

    const messaging = getFirebaseAdminMessaging()
    for (let offset = 0; offset < tokens.length; offset += MAX_BATCH_SIZE) {
      const batch = tokens.slice(offset, offset + MAX_BATCH_SIZE)
      const batchResult = await this.sendBatchWithRetry(messaging, batch, payload)
      result.attempted += batch.length
      result.successful += batchResult.successful
      result.failed += batchResult.failed
      result.removedTokens += batchResult.removedTokens
      this.mergeErrors(result.errors, batchResult.errors)
    }

    return result
  }

  private async loadTokens(recipients: Recipient[]): Promise<string[]> {
    const uniqueRecipients = [...new Map(recipients.map((r) => [`${r.role}:${r.id}`, r])).values()]
    const accountIds = await Promise.all(uniqueRecipients.map(async (recipient) => {
      const model = this.profileModel(recipient.role)
      const profile = await (prisma as any)[model].findUnique({
        where: { id: recipient.id },
        select: { accountId: true },
      }) as { accountId: string | null } | null
      return profile?.accountId ? { accountId: profile.accountId, role: recipient.role } : null
    }))

    const grouped = new Map<string, string[]>()
    for (const item of accountIds) {
      if (!item) continue
      const ids = grouped.get(item.role) ?? []
      ids.push(item.accountId)
      grouped.set(item.role, ids)
    }

    const rows = await Promise.all([...grouped.entries()].map(([role, userIds]) =>
      prisma.deviceToken.findMany({
        where: { role, userId: { in: userIds }, enabled: true },
        select: { token: true },
      })
    ))
    console.log('[PushService] Loaded device tokens for recipients', {
      rows,
    })
    // return [...new Set(rows.flat().map((row) => row.token))]
  }



  private async sendBatchWithRetry(
  messaging: Messaging,
  tokens: string[],
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const message: MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        webpush: {
          fcmOptions: {
            link: payload.data?.url,
          },
        },
      }

      const response = await messaging.sendEachForMulticast(message)

      console.log('[PushService] Multicast delivered', {
        attempted: tokens.length,
        successful: response.successCount,
        failed: response.failureCount,
        tokensExhausted: response.responses.every((entry) => entry.success),
      })

      const invalidTokens: string[] = []
      const errors = new Map<string, number>()

      response.responses.forEach((entry, index) => {
        if (entry.success) {
          return
        }

        const token = tokens[index]
        const code = entry.error?.code ?? "unknown"

        errors.set(code, (errors.get(code) ?? 0) + 1)

        console.error("[PushService] Token send failed", {
          index,
          code: entry.error?.code,
          message: entry.error?.message,
        })

        if (token && INVALID_TOKEN_CODES.has(code)) {
          invalidTokens.push(token)
        }

        if (token && CREDENTIAL_ERROR_CODES.has(code)) {
          console.error(
            "[PushService] Credential mismatch detected",
            {
              adminProject: process.env.FIREBASE_PROJECT_ID,
              senderId:
                process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
              token: `${token.substring(0, 40)}...`,
            },
          )
        }
      })

      let removedTokens = 0

      if (invalidTokens.length) {
        const deleted = await prisma.deviceToken.deleteMany({
          where: {
            token: {
              in: invalidTokens,
            },
          },
        })

        removedTokens = deleted.count

        console.warn("[PushService] Removed invalid device tokens", {
          count: removedTokens,
        })
      }

      return {
        attempted: tokens.length,
        successful: response.successCount,
        failed: response.failureCount,
        removedTokens,
        errors: [...errors.entries()].map(([code, count]) => ({
          code,
          count,
        })),
      }
    } catch (error) {
      lastError = error

      console.error(
        "[PushService] sendEachForMulticast threw an exception:",
        error,
      )

      const code = this.errorCode(error)

      console.warn("[PushService] Multicast attempt failed", {
        attempt,
        code,
        retryable: RETRYABLE_CODES.has(code),
      })

      if (!RETRYABLE_CODES.has(code) || attempt === MAX_ATTEMPTS) {
        break
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 250 * 2 ** (attempt - 1)),
      )
    }
  }

  const code = this.errorCode(lastError)

  console.error("[PushService] Delivery failed", {
    code,
    tokenCount: tokens.length,
  })

  return {
    attempted: tokens.length,
    successful: 0,
    failed: tokens.length,
    removedTokens: 0,
    errors: [
      {
        code,
        count: tokens.length,
      },
    ],
  }
}

  private errorCode(error: unknown): string {
    return error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'unknown-error'
  }

  private mergeErrors(target: Array<{ code: string; count: number }>, source: Array<{ code: string; count: number }>) {
    for (const error of source) {
      const existing = target.find((item) => item.code === error.code)
      if (existing) existing.count += error.count
      else target.push({ ...error })
    }
  }

  private profileModel(role: Recipient['role']): string {
    return {
      admin: 'adminUser',
      merchant: 'merchant',
      company_admin: 'companyAdmin',
      employee: 'employee',
    }[role]
  }
}

export const PushService = new PushServiceClass()
