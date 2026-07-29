// Haversine distance in kilometres between two lat/lng points.
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Resolves the best branch coordinate for a merchant. Prefers the primary
// branch, otherwise the first branch with both lat/lng populated.
export function branchCoordinate(
  branches: { isPrimary?: boolean; latitude: unknown; longitude: unknown }[],
): { latitude: number; longitude: number } | null {
  const candidates = branches.filter(
    (b) => b.latitude != null && b.longitude != null,
  ) as { isPrimary?: boolean; latitude: { toString(): string } | number; longitude: { toString(): string } | number }[]

  if (candidates.length === 0) return null
  const primary = candidates.find((b) => b.isPrimary)
  const pick = primary ?? candidates[0]
  return {
    latitude: Number(pick!.latitude as { toString(): string } | number),
    longitude: Number(pick!.longitude as { toString(): string } | number),
  }
}
