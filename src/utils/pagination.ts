import type { APIMeta, PaginationParams } from '@/types';

export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  return {
    page: parseInt(searchParams.get('page') ?? '1'),
    pageSize: Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 100),
    sortBy: searchParams.get('sortBy') ?? undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc',
  };
}

export function buildMeta(
  total: number,
  page: number,
  pageSize: number
): APIMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
