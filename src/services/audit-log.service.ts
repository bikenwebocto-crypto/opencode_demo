import { prisma } from '@/lib/prisma';
import type { CurrentUser } from '@/lib/supabase/server';

export interface AuditLogInput {
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: unknown;
  metadata?: unknown;
}

export function buildAuditData(input: AuditLogInput) {
  const { actorType, actorId, action, entityType, entityId, changes, metadata } = input;

  if (!actorId) {
    return {
      actorType: 'system',
      action,
      entityType,
      entityId,
      changes: changes as any ?? undefined,
      metadata: metadata as any ?? undefined,
    };
  }

  const fieldMap: Record<string, string> = {
    admin: 'adminId',
    merchant: 'merchantId',
    company_admin: 'companyAdminId',
    employee: 'employeeId',
  };

  const fkField = fieldMap[actorType];
  if (fkField) {
    return {
      actorType,
      [fkField]: actorId,
      action,
      entityType,
      entityId,
      changes: changes as any ?? undefined,
      metadata: metadata as any ?? undefined,
    };
  }

  return {
    actorType,
    action,
    entityType,
    entityId,
    changes: changes as any ?? undefined,
    metadata: { ...(metadata as any ?? {}), [actorType + 'Id']: actorId },
  };
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const data = buildAuditData(input);
    await prisma.auditLog.create({ data: data as any });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export function fromCurrentUser(
  user: CurrentUser,
  action: string,
  entityType: string,
  entityId: string,
  opts?: { changes?: unknown; metadata?: unknown },
): AuditLogInput {
  return {
    actorType: user.userType,
    actorId: user.profileId,
    action,
    entityType,
    entityId,
    changes: opts?.changes,
    metadata: opts?.metadata,
  };
}
