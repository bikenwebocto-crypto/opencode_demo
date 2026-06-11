import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export class BaseRepository<T, CreateInput, UpdateInput> {
  protected model: {
    findUnique: (args: any) => Promise<T | null>;
    findFirst: (args: any) => Promise<T | null>;
    findMany: (args: any) => Promise<T[]>;
    create: (args: any) => Promise<T>;
    update: (args: any) => Promise<T>;
    delete: (args: any) => Promise<T>;
    count: (args: any) => Promise<number>;
  };

  constructor(modelName: keyof typeof prisma) {
    this.model = (prisma[modelName] as any);
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  async findFirst(where: Record<string, unknown>): Promise<T | null> {
    return this.model.findFirst({ where });
  }

  async findMany(params?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
    include?: Record<string, unknown>;
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    return this.model.findMany(params ?? {});
  }

  async findManyPaginated(params: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
    include?: Record<string, unknown>;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20, ...rest } = params;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.model.findMany({ ...(rest as any), skip, take: pageSize }),
      this.model.count({ where: (rest as any).where }),
    ]);
    return {
      data: data as T[],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async create(data: CreateInput): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return this.model.count({ where: where ?? {} });
  }

  async exists(where: Record<string, unknown>): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }
}
