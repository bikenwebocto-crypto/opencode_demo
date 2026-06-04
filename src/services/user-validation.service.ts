import { prisma } from '@/lib/prisma';
import type { AccountRole, ProfileType, AccountStatus } from '@/types';

export interface UserValidationResult {
  exists: boolean;
  role: 'ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE' | 'MERCHANT' | null;
  userId: string | null;
}

export async function validateUserEmail(email: string): Promise<UserValidationResult> {
  const [admin, merchant, companyAdmin, employee, existingAccount] = await Promise.all([
    prisma.adminUser.findUnique({ where: { email }, select: { id: true } }),
    prisma.merchant.findUnique({ where: { email }, select: { id: true } }),
    prisma.companyAdmin.findUnique({ where: { email }, select: { id: true } }),
    prisma.employee.findUnique({ where: { email }, select: { id: true } }),
    prisma.account.findUnique({ where: { email }, select: { authUserId: true } }),
  ]);

  if (existingAccount) {
    return { exists: true, role: null, userId: existingAccount.authUserId };
  }
  if (admin) return { exists: true, role: 'ADMIN', userId: admin.id };
  if (merchant) return { exists: true, role: 'MERCHANT', userId: merchant.id };
  if (companyAdmin) return { exists: true, role: 'COMPANY_ADMIN', userId: companyAdmin.id };
  if (employee) return { exists: true, role: 'EMPLOYEE', userId: employee.id };

  return { exists: false, role: null, userId: null };
}

interface CreateAccountParams {
  authUserId: string;
  email: string;
  role: AccountRole;
  profileId: string;
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
      profileId: params.profileId,
      profileType: params.profileType,
      status: params.status ?? 'ACTIVE',
      createdBy: params.createdBy,
    },
  });
}
