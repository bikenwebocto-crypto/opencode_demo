export const COMPLAINT_TYPE_PRIORITY_MAP: Record<string, string> = {
  MISLEADING: 'HIGH',
  POLICY_VIOLATION: 'HIGH',
  INVALID_TERMS: 'MEDIUM',
  NON_FUNCTIONAL: 'MEDIUM',
}

export function getPriorityForType(complaintType: string): string {
  return COMPLAINT_TYPE_PRIORITY_MAP[complaintType] ?? 'MEDIUM'
}
