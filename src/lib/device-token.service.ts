import { prisma } from '@/lib/prisma'

// Role stored on DeviceToken rows. Must stay lowercase ('employee') to
// match the push service query (`push.service.ts` filters by
// recipient.role) and the web `userType` convention.
const MOBILE_ROLE = 'employee'

export interface ActivateDeviceTokenParams {
  userId: string
  token: string
  deviceId?: string | null
  platform?: string
}

// Upsert an FCM token for an authenticated user and mark it active.
// Called on login / token refresh so the push service delivers to it.
export async function activateDeviceToken({
  userId,
  token,
  deviceId = null,
  platform = 'mobile',
}: ActivateDeviceTokenParams) {
  if (!token) return null

  // Never hijack a token registered to another user. A token belongs to a
  // single device; if ownership differs, keep the original owner's row.
  const existing = await prisma.deviceToken.findUnique({
    where: { token },
    select: { userId: true },
  })
  if (existing && existing.userId !== userId) {
    console.warn('[DeviceTokenService] Refusing to reassign token to another user', {
      existingUserId: existing.userId,
      requestedUserId: userId,
    })
    return null
  }

  return prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId,
      role: MOBILE_ROLE,
      platform,
      deviceId: deviceId ?? null,
      enabled: true,
      lastSeen: new Date(),
    },
    create: {
      userId,
      role: MOBILE_ROLE,
      token,
      platform,
      deviceId: deviceId ?? null,
      enabled: true,
      lastSeen: new Date(),
    },
  })
}

export interface DeactivateDeviceTokenParams {
  userId: string
  deviceId?: string | null
  token?: string | null
}

// Mark matching device token row(s) inactive so the push service stops
// delivering to them. Called on logout. At least one of deviceId / token
// is required to target a row.
export async function deactivateDeviceToken({
  userId,
  deviceId,
  token,
}: DeactivateDeviceTokenParams) {
  if (!deviceId && !token) return { count: 0 }
  return prisma.deviceToken.updateMany({
    where: {
      userId,
      role: MOBILE_ROLE,
      ...(deviceId ? { deviceId } : {}),
      ...(token ? { token } : {}),
    },
    data: { enabled: false },
  })
}
