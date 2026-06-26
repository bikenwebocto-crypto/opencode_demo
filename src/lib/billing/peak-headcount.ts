/**
 * Peak headcount tracking (read-only from admin UI).
 *
 * Per the task constraints we MUST NOT add new tables or schema fields.
 * The peak 30-day headcount is therefore persisted as a single JSON
 * entry in the existing `PlatformSettings` table, keyed by
 *   `company:{companyId}:peak30d`
 * with shape `{ peak: number, recordedAt: ISO8601 }`.
 *
 * The peak is computed from existing data on every read:
 *   - we consider the active employees on the current Company
 *   - and the historical high tracked in PlatformSettings
 *   - whichever is higher wins
 *
 * "Reset" on renewal-paid simply clears the PlatformSettings key.
 */

import { prisma } from '@/lib/prisma'

const PEAK_KEY_PREFIX = 'company:'
const PEAK_KEY_SUFFIX = ':peak30d'

export function peakKey(companyId: string): string {
  return `${PEAK_KEY_PREFIX}${companyId}${PEAK_KEY_SUFFIX}`
}

export interface PeakRecord {
  peak: number
  recordedAt: string
}

export async function readPeak(
  companyId: string,
): Promise<PeakRecord | null> {
  const row = await prisma.platformSettings.findUnique({
    where: { key: peakKey(companyId) },
  })
  if (!row) return null
  const v = row.value as Partial<PeakRecord> | null
  if (!v || typeof v.peak !== 'number') return null
  return { peak: v.peak, recordedAt: v.recordedAt ?? new Date(0).toISOString() }
}

export async function writePeak(
  companyId: string,
  peak: number,
): Promise<PeakRecord> {
  const record: PeakRecord = {
    peak,
    recordedAt: new Date().toISOString(),
  }
  await prisma.platformSettings.upsert({
    where: { key: peakKey(companyId) },
    create: {
      key: peakKey(companyId),
      value: record as any,
    },
    update: {
      value: record as any,
    },
  })
  return record
}

export async function clearPeak(companyId: string): Promise<void> {
  await prisma.platformSettings
    .delete({ where: { key: peakKey(companyId) } })
    .catch(() => {
      /* swallow "not found" — clearing a non-existent peak is a no-op */
    })
}

/**
 * Bump the peak: read existing, take max(existing, candidate), persist.
 * Returns the resulting record.
 */
export async function bumpPeak(
  companyId: string,
  candidate: number,
): Promise<PeakRecord> {
  const existing = await readPeak(companyId)
  const next = Math.max(existing?.peak ?? 0, candidate)
  return writePeak(companyId, next)
}

/**
 * Count currently-active employees for a company.
 * Mirrors the company-billing API definition: `ACTIVE` and not soft-deleted.
 */
export async function countActiveEmployees(companyId: string): Promise<number> {
  return prisma.employee.count({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
  })
}
