/**
 * Date utilities shared by the analytics services.
 * No I/O — pure functions only.
 */

/** Returns the start of the day for the given date (local time). */
export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Returns the first day of the current month at 00:00:00. */
export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/**
 * Build a continuous date series of `days` length ending today, zero-filled
 * with the given seed values keyed by ISO date string.
 */
export function buildDateSeries<T>(
  days: number,
  seeds: Map<string, T>,
  empty: () => T,
  endDate: Date = new Date(),
): Array<{ date: string; value: T }> {
  const today = startOfDay(endDate)
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  const series: Array<{ date: string; value: T }> = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    series.push({
      date: key,
      value: seeds.get(key) ?? empty(),
    })
  }
  return series
}

/** Format a date as "Mon DD, YYYY" for display. */
export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
