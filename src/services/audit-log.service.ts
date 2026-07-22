import { prisma } from '@/lib/prisma';
import type { CurrentUser } from '@/lib/supabase/server';

export interface AuditLogInput {
  actorType: 'admin' | 'merchant' | 'company_admin' | 'employee' | 'system';

  actorId?: string | null;

  // Explicit foreign keys
  adminId?: string | null;
  merchantId?: string | null;
  companyAdminId?: string | null;
  employeeId?: string | null;

  action: string;
  entityType: string;
  entityId: string;

  changes?: unknown;
  metadata?: unknown;
}

export function buildAuditData(input: AuditLogInput) {
  const {
    actorType,
    actorId,

    adminId,
    merchantId,
    companyAdminId,
    employeeId,

    action,
    entityType,
    entityId,
    changes,
    metadata,
  } = input;

  const data: any = {
    actorType,
    action,
    entityType,
    entityId,
    changes: changes ?? undefined,
    metadata: metadata ?? undefined,
  };

  if (!actorId) {
    data.actorType = 'system';
    return data;
  }

  switch (actorType) {
    case 'admin':
      data.adminId = adminId ?? actorId;
      break;

    case 'merchant':
      // NEVER overwrite an explicitly supplied merchantId
      data.merchantId = merchantId ?? actorId;
      break;

    case 'company_admin':
      data.companyAdminId = companyAdminId ?? actorId;
      break;

    case 'employee':
      data.employeeId = employeeId ?? actorId;
      break;

    default:
      data.metadata = {
        ...(metadata as any ?? {}),
        actorId,
      };
  }

  return data;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const data = buildAuditData(input);

    console.log('Audit Data:', data);

    await prisma.auditLog.create({
      data,
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export function fromCurrentUser(
  user: CurrentUser,
  action: string,
  entityType: string,
  entityId: string,
  opts?: {
    changes?: unknown;
    metadata?: unknown;
  },
): AuditLogInput {
  return {
    actorType: user.userType as AuditLogInput['actorType'],
    actorId: user.profileId,

    action,
    entityType,
    entityId,

    changes: opts?.changes,
    metadata: opts?.metadata,
  };
}