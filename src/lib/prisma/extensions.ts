import { Prisma } from '@prisma/client';
import { prisma } from './client';

// Soft delete middleware
prisma.$use(async (params, next) => {
  const modelsWithSoftDelete = ['Company', 'Employee', 'Merchant'];
  const isSoftDeleteModel = modelsWithSoftDelete.includes(params.model ?? '');

  // Intercept find queries to exclude soft-deleted records
  if (isSoftDeleteModel) {
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst';
      params.args.where = { ...params.args.where, deletedAt: null };
    }
    if (params.action === 'findMany') {
      if (!params.args?.where?.deletedAt) {
        params.args.where = { ...params.args.where, deletedAt: null };
      }
    }
  }

  return next(params);
});

// Audit logging middleware for critical mutations
prisma.$use(async (params, next) => {
  const result = await next(params);

  const auditActions: Record<string, string[]> = {
    Merchant: ['update', 'delete'],
    Company: ['update', 'delete'],
    MerchantOffer: ['update', 'delete'],
    Employee: ['update', 'delete'],
  };

  const relevantActions = auditActions[params.model ?? ''];
  if (relevantActions?.includes(params.action)) {
    // Queue audit log entry asynchronously
    prisma.auditLog
      .create({
        data: {
          actorId: 'system',
          actorType: 'system',
          action: `${params.model?.toLowerCase()}.${params.action}`,
          entityType: params.model?.toLowerCase() ?? 'unknown',
          entityId: (params.args?.where?.id as string) ?? 'unknown',
          changes: params.args?.data ? { before: null, after: params.args.data } : undefined,
          metadata: { action: params.action },
        },
      })
      .catch((err) => console.error('Audit log error:', err));
  }

  return result;
});

// Pagination helper
export async function paginate<T>(
  model: {
    findMany: (args: Prisma.Args<typeof prisma, 'findMany'>) => Promise<T[]>;
    count: (args: Prisma.Args<typeof prisma, 'count'>) => Promise<number>;
  },
  args: Prisma.Args<typeof prisma, 'findMany'>,
  page: number = 1,
  pageSize: number = 20
): Promise<{
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}> {
  const skip = (page - 1) * pageSize;
  const [data, total] = await Promise.all([
    model.findMany({
      ...args,
      skip,
      take: pageSize,
    }),
    model.count({
      where: args.where,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
