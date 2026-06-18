import type { CompanyAdmin, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CompanyAdminSummary, CompanyAdminStatus } from '@/types'

/**
 * Derive a "Primary Admin" view-model from a list of CompanyAdmin rows.
 *
 * Precedence (per spec):
 *   1. First ACTIVE admin flagged isPrimary=true
 *      (the schema uses isPrimary instead of a role='OWNER' enum)
 *   2. Otherwise, the oldest ACTIVE admin
 *   3. Otherwise, null (display "No Admin Assigned")
 */
export function derivePrimaryAdmin(
  admins: CompanyAdmin[] | CompanyAdminSummary[] | undefined | null,
): CompanyAdminSummary | null {
  if (!admins || admins.length === 0) return null
  const active = admins.filter((a) => a.isActive)
  if (active.length === 0) return null

  const primary = active.find((a) => a.isPrimary)
  if (primary) return toSummary(primary)

  const sorted = [...active].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  return toSummary(sorted[0]!)
}

export function toAdminSummary(a: CompanyAdmin): CompanyAdminSummary {
  return {
    id: a.id,
    companyId: a.companyId,
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    role: a.isPrimary ? 'OWNER' : 'MEMBER',
    status: (a.isActive ? 'ACTIVE' : 'INACTIVE') as CompanyAdminStatus,
    isPrimary: a.isPrimary,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt ?? null,
    createdAt: a.createdAt,
  }
}

function toSummary(
  a: CompanyAdmin | CompanyAdminSummary,
): CompanyAdminSummary {
  if ('role' in a && 'status' in a) {
    return a as CompanyAdminSummary
  }
  return toAdminSummary(a as CompanyAdmin)
}

export function summarizeAdmins(
  admins: CompanyAdmin[] | undefined | null,
): CompanyAdminSummary[] {
  if (!admins) return []
  return admins.map(toAdminSummary)
}

/**
 * Make sure the given company has exactly one isPrimary=true admin.
 *
 * Auto-fix rules (per spec):
 *   1. If no admin has isPrimary=true:
 *      a. Find an ACTIVE OWNER (isPrimary=true AND isActive=true) — none.
 *      b. Otherwise pick the oldest ACTIVE admin and set isPrimary=true.
 *   2. If multiple admins have isPrimary=true, keep the oldest ACTIVE one
 *      and demote the rest.
 *   3. If the current primary is INACTIVE, transfer primary to the
 *      oldest ACTIVE admin (or null if none).
 *
 * Returns the id of the current primary admin (or null if none).
 * The mutation runs inside a transaction to keep the data consistent.
 */
export async function ensurePrimaryAdmin(
  companyId: string,
  tx?: Prisma.TransactionClient,
): Promise<string | null> {
  const client = tx ?? prisma
  const admins = await client.companyAdmin.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
  })

  if (admins.length === 0) return null

  const currentPrimary = admins.find((a) => a.isPrimary)
  const activeAdmins = admins.filter((a) => a.isActive)

  // Case 1: no active admins at all — demote everyone who has isPrimary=true
  if (activeAdmins.length === 0) {
    if (currentPrimary) {
      await client.companyAdmin.update({
        where: { id: currentPrimary.id },
        data: { isPrimary: false },
      })
    }
    return null
  }

  // Case 2: current primary is active and is the only one — done
  const primaryCount = admins.filter((a) => a.isPrimary).length
  if (
    currentPrimary &&
    currentPrimary.isActive &&
    primaryCount === 1
  ) {
    return currentPrimary.id
  }

  // Case 3: pick the best candidate
  // Prefer the current primary if still active.
  // Otherwise pick the oldest active admin. (We know `activeAdmins`
  // is non-empty here because Case 1 short-circuited above.)
  let chosen: CompanyAdmin | undefined = currentPrimary
  if (!chosen || !chosen.isActive) {
    chosen = activeAdmins[0]
  }
  if (!chosen) {
    // Defensive: should be unreachable because Case 1 returned null
    // when there are no active admins.
    return null
  }

  // Demote everyone except the chosen one.
  const toDemote = admins
    .filter((a) => a.isPrimary && a.id !== chosen.id)
    .map((a) => a.id)
  for (const id of toDemote) {
    await client.companyAdmin.update({
      where: { id },
      data: { isPrimary: false },
    })
  }

  if (!chosen.isPrimary) {
    await client.companyAdmin.update({
      where: { id: chosen.id },
      data: { isPrimary: true },
    })
  }

  return chosen.id
}

export class PrimaryAdminGuardError extends Error {
  code = 'PRIMARY_ADMIN_REQUIRED'
  constructor(message = 'Each company must have at least one active primary administrator.') {
    super(message)
    this.name = 'PrimaryAdminGuardError'
  }
}

/**
 * Validate that disabling the given admin would not leave the company
 * without an active primary admin. Throws PrimaryAdminGuardError if so.
 *
 * Rules:
 *   - If the target is the only ACTIVE primary admin, refuse.
 *   - The caller must either: (a) transfer primary first, or
 *   (b) ensure another ACTIVE admin is flagged primary.
 */
export async function assertCanDisableAdmin(
  companyId: string,
  adminId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma
  const target = await client.companyAdmin.findUnique({
    where: { id: adminId },
    select: { companyId: true, isActive: true, isPrimary: true },
  })
  if (!target || target.companyId !== companyId) {
    throw new Error('Company admin not found in this company')
  }
  if (!target.isActive) {
    // Disabling an already-inactive admin is harmless — let it through.
    return
  }
  if (!target.isPrimary) {
    // Disabling a non-primary admin never threatens the primary slot.
    return
  }

  // Target is the (or an) active primary. Count other active admins
  // that could be promoted.
  const otherActiveCount = await client.companyAdmin.count({
    where: {
      companyId,
      id: { not: adminId },
      isActive: true,
    },
  })
  if (otherActiveCount === 0) {
    throw new PrimaryAdminGuardError()
  }
}
