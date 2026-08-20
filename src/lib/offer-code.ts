import { prisma } from '@/lib/prisma'

/**
 * Generate a unique 6-character alphanumeric offer code.
 * Format: uppercase letters and digits only (e.g. AB42KX, M8XQ1P).
 * Retries up to maxAttempts times if a collision is detected.
 */
export async function generateUniqueOfferCode(
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateOfferCode()
    const existing = await prisma.offerRedemption.findFirst({
      where: {
        configuration: { path: ['code'], equals: code },
      },
      select: { id: true },
    })
    if (!existing) return code
  }
  throw new Error('Failed to generate unique offer code after maximum attempts')
}

/**
 * Generate a random 6-character alphanumeric code.
 * Characters: A-Z (excluding I, O for clarity) and 2-9 (excluding 0, 1 for clarity).
 */
export function generateOfferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Validate offer code format: exactly 6 alphanumeric uppercase characters.
 */
export function isValidOfferCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code)
}

/**
 * Normalize offer code to uppercase and trim whitespace.
 */
export function normalizeOfferCode(code: string): string {
  return code.trim().toUpperCase()
}
