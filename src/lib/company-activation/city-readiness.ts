/**
 * City Readiness Gate.
 *
 * Before a company can be marked ACTIVE, the system verifies that
 * the company's city has enough active merchants and unique
 * categories to support a launch.
 *
 * Defaults: 20 active merchants, 6 unique categories.
 * These are intentionally hard-coded as constants so they can be
 * easily promoted to PlatformSettings without touching the rest of
 * the code.
 */

import { prisma } from '@/lib/prisma'

export const CITY_READINESS_DEFAULTS = {
  minActiveMerchants: 20,
  minUniqueCategories: 6,
} as const

export interface CityReadinessResult {
  city: string | null
  activeMerchants: number
  uniqueCategories: number
  required: {
    minActiveMerchants: number
    minUniqueCategories: number
  }
  ready: boolean
  message: string
}

export async function getCityReadiness(
  city: string | null
): Promise<CityReadinessResult> {
  const required = {
    minActiveMerchants: CITY_READINESS_DEFAULTS.minActiveMerchants,
    minUniqueCategories: CITY_READINESS_DEFAULTS.minUniqueCategories,
  }

  if (!city) {
    return {
      city: null,
      activeMerchants: 0,
      uniqueCategories: 0,
      required,
      ready: false,
      message: 'No city on file. Set the company headquarters city before activation.',
    }
  }

  const [activeMerchants, distinctCategories] = await Promise.all([
    prisma.merchant.count({
      where: {
        city: { equals: city, mode: 'insensitive' },
        status: 'ACTIVE',
        deletedAt: null,
      },
    }),
    prisma.merchant.findMany({
      where: {
        city: { equals: city, mode: 'insensitive' },
        status: 'ACTIVE',
        deletedAt: null,
        categoryId: { not: null },
      },
      select: { categoryId: true },
      distinct: ['categoryId'],
    }),
  ])

  const uniqueCategories = distinctCategories.filter((m) => !!m.categoryId).length
  const ready =
    activeMerchants >= required.minActiveMerchants &&
    uniqueCategories >= required.minUniqueCategories

  const message = ready
    ? `${city} has ${activeMerchants} active merchants across ${uniqueCategories} categories.`
    : `${city} has ${activeMerchants} active merchants across ${uniqueCategories} categories. Minimum required: ${required.minActiveMerchants} merchants across ${required.minUniqueCategories} categories.`

  return {
    city,
    activeMerchants,
    uniqueCategories,
    required,
    ready,
    message,
  }
}

export class CityReadinessError extends Error {
  code = 'CITY_NOT_READY'
  constructor(
    public readiness: CityReadinessResult
  ) {
    super(readiness.message)
  }
}
