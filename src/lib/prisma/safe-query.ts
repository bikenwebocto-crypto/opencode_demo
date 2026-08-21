import { Prisma } from '@prisma/client';

interface SafeQueryOptions {
  context?: string; // e.g. "LoginBranding.findFirst" for log tracing
}

export async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
  options: SafeQueryOptions = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const context = options.context ?? 'unknown query';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`[Prisma:${context}] code=${error.code} message=${error.message}`);
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error(`[Prisma:${context}] connection/init error: ${error.message}`);
    } else {
      console.error(`[Prisma:${context}] unexpected error:`, error);
    }
    return fallback;
  }
}
