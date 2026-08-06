import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PushService } from '@/services/push.service'

const sendEachForMulticast = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminMessaging: () => ({ sendEachForMulticast }),
}))

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({ accountId: 'account-1' } as any)
    vi.mocked(prisma.deviceToken.findMany).mockResolvedValue([
      { token: 'valid-token' },
      { token: 'expired-token' },
    ] as any)
    vi.mocked(prisma.deviceToken.deleteMany).mockResolvedValue({ count: 1 } as any)
  })

  it('sends multicast notifications and removes invalid registration tokens', async () => {
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true, messageId: 'message-1' },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    })

    const result = await PushService.sendToRecipients(
      [{ role: 'employee', id: 'employee-1' }],
      { title: 'Test', body: 'Test notification' },
    )

    expect(sendEachForMulticast).toHaveBeenCalledOnce()
    expect(sendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({
      tokens: ['valid-token', 'expired-token'],
    }))
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['expired-token'] } },
    })
    expect(result).toMatchObject({ attempted: 2, successful: 1, failed: 1, removedTokens: 1 })
  })

  it('retries quota failures and returns a successful result', async () => {
    sendEachForMulticast
      .mockRejectedValueOnce({ code: 'messaging/quota-exceeded' })
      .mockResolvedValueOnce({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      })

    const result = await PushService.sendToRecipients(
      [{ role: 'employee', id: 'employee-1' }],
      { title: 'Test' },
    )

    expect(sendEachForMulticast).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ attempted: 2, successful: 2, failed: 0 })
  })

  it('returns failures for non-retryable service errors without throwing', async () => {
    sendEachForMulticast.mockRejectedValue({ code: 'messaging/invalid-argument' })

    const result = await PushService.sendToRecipients(
      [{ role: 'employee', id: 'employee-1' }],
      { title: 'Test' },
    )

    expect(result).toMatchObject({ attempted: 2, successful: 0, failed: 2 })
    expect(result.errors).toEqual([{ code: 'messaging/invalid-argument', count: 2 }])
  })
})
