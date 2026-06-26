import { prisma } from '@/lib/prisma';
import { validateUniqueEmail } from '@/lib/account-email';
import type { AccountRole, ProfileType, AccountStatus } from '@/types';

export interface UserValidationResult {
  exists: boolean;
  role: 'ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE' | 'MERCHANT' | null;
  userId: string | null;
}

export async function validateUserEmail(email: string): Promise<UserValidationResult> {
  const result = await validateUniqueEmail(email);

  if (!result.exists) {
    return { exists: false, role: null, userId: null };
  }

  return {
    exists: true,
    role: result.ownerType,
    userId: result.ownerId,
  };
}

interface CreateAccountParams {
  authUserId: string;
  email: string;
  role: AccountRole;
  profileType: ProfileType;
  status?: AccountStatus;
  createdBy?: string | null;
}

export async function createAccountForProfile(params: CreateAccountParams) {
  return prisma.account.create({
    data: {
      authUserId: params.authUserId,
      email: params.email,
      role: params.role,
      profileType: params.profileType,
      status: params.status ?? 'ACTIVE',
      createdBy: params.createdBy,
    },
  });
}
