import { prisma } from '@/lib/prisma'

export interface EmailOwnerResult {
  exists: boolean
  ownerId: string | null
  ownerType: 'ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE' | 'MERCHANT' | null
}

export async function findAccountByEmail(email: string) {
  return prisma.account.findUnique({
    where: { email },
  })
}

export async function validateUniqueEmail(
  email: string,
  excludeAuthUserId?: string
): Promise<EmailOwnerResult> {
  const account = excludeAuthUserId
    ? await prisma.account.findFirst({
        where: { email, authUserId: { not: excludeAuthUserId } },
        select: { authUserId: true, role: true },
      })
    : await prisma.account.findUnique({
        where: { email },
        select: { authUserId: true, role: true },
      })

  if (!account) {
    return { exists: false, ownerId: null, ownerType: null }
  }

  return {
    exists: true,
    ownerId: account.authUserId,
    ownerType: account.role as EmailOwnerResult['ownerType'],
  }
}

export async function getAccountByEmail(
  email: string
): Promise<{ authUserId: string; role: string } | null> {
  const account = await prisma.account.findUnique({
    where: { email },
    select: { authUserId: true, role: true },
  })
  if (!account) return null
  return {
    authUserId: account.authUserId,
    role: account.role,
  }
}
