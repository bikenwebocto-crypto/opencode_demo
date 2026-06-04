import { prisma } from '@/lib/prisma';
import type { AuthUser, JWTPayload, LoginRequest, LoginResponse, UserType } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_BYTES = 64;

export class AuthService {
  private readonly saltRounds = 12;

  async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(payload: JWTPayload): string {
    const jwt = require('jsonwebtoken');
    const { exp, ...claims } = payload;
    return jwt.sign(claims, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  generateRefreshToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  private isUserActive(user: any, userType: string): boolean {
    if (user.isActive !== undefined) return user.isActive === true
    return user.status === 'ACTIVE'
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const jwt = require('jsonwebtoken');
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return null;
    }
  }

  async login(request: LoginRequest): Promise<LoginResponse | null> {
    const { email, password, userType } = request;

    // First, look up the Account record
    const account = await prisma.account.findUnique({ where: { email } });
    if (!account || account.status !== 'ACTIVE') return null;

    // Find the actual profile record to verify password
    const user = await this.findUserByType(email, userType);
    if (!user) return null;

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) return null;

    if (!this.isUserActive(user, userType)) return null;

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      user_type: userType,
      account_role: account.role,
      ...(userType === 'admin' && { admin_role: (user as any).role }),
      ...(userType === 'merchant' && { merchant_id: user.id }),
      ...((userType === 'company_admin' || userType === 'employee') && {
        company_id: (user as any).companyId ?? (user as any).company_id,
      }),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();

    await prisma.loginSession.create({
      data: {
        ...this.sessionIdField(user.id, userType),
        userType,
        refreshToken,
        accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.updateLastLogin(user.id, userType);
    await prisma.account.update({
      where: { authUserId: account.authUserId },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: this.mapToAuthUser(user, userType),
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<LoginResponse | null> {
    const session = await prisma.loginSession.findUnique({
      where: { refreshToken, isActive: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const sessionUserId = this.getSessionUserId(session);
    if (!sessionUserId) return null;

    const user = await this.findUserById(sessionUserId, session.userType);
    const userType = session.userType as UserType;
    if (!user || !this.isUserActive(user, userType)) return null;

    const account = await prisma.account.findUnique({ where: { email: user.email } });

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      user_type: userType,
      account_role: account?.role,
      ...(userType === 'admin' && { admin_role: (user as any).role }),
      ...(userType === 'merchant' && { merchant_id: user.id }),
      ...((userType === 'company_admin' || userType === 'employee') && {
        company_id: (user as any).companyId,
      }),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    };

    const accessToken = this.generateAccessToken(payload);

    await prisma.loginSession.update({
      where: { id: session.id },
      data: { accessToken, lastActivityAt: new Date() },
    });

    return {
      user: this.mapToAuthUser(user, userType),
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.loginSession.updateMany({
      where: { refreshToken },
      data: { isActive: false },
    });
  }

  async invalidateAllSessions(userId: string, userType: UserType): Promise<void> {
    const idField = this.sessionIdField(userId, userType);
    await prisma.loginSession.updateMany({
      where: { ...idField, userType, isActive: true },
      data: { isActive: false },
    });
  }

  // --- Private helpers ---

  private async findUserByType(email: string, userType: UserType) {
    switch (userType) {
      case 'admin':
        return prisma.adminUser.findUnique({ where: { email } });
      case 'merchant':
        return prisma.merchant.findUnique({ where: { email } });
      case 'company_admin':
        return prisma.companyAdmin.findUnique({
          where: { email },
          include: { company: { select: { id: true } } },
        });
      case 'employee':
        return prisma.employee.findUnique({
          where: { email },
          include: { company: { select: { id: true } } },
        });
      default:
        return null;
    }
  }

  private async findUserById(id: string, userType: string) {
    switch (userType) {
      case 'admin':
        return prisma.adminUser.findUnique({ where: { id } });
      case 'merchant':
        return prisma.merchant.findUnique({ where: { id } });
      case 'company_admin':
        return prisma.companyAdmin.findUnique({ where: { id }, include: { company: { select: { id: true } } } });
      case 'employee':
        return prisma.employee.findUnique({ where: { id }, include: { company: { select: { id: true } } } });
      default:
        return null;
    }
  }

  private async updateLastLogin(userId: string, userType: UserType): Promise<void> {
    const now = new Date();
    switch (userType) {
      case 'admin':
        await prisma.adminUser.update({ where: { id: userId }, data: { lastLoginAt: now } });
        break;
      case 'company_admin':
        await prisma.companyAdmin.update({ where: { id: userId }, data: { lastLoginAt: now } });
        break;
      case 'employee':
        await prisma.employee.update({ where: { id: userId }, data: { lastLoginAt: now } });
        break;
    }
  }

  private mapToAuthUser(user: any, userType: UserType): AuthUser {
    return {
      id: user.id,
      email: user.email,
      userType,
      role: user.role,
      merchantId: userType === 'merchant' ? user.id : undefined,
      companyId: user.company?.id ?? user.companyId,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      isActive: user.isActive,
    };
  }

  // Map userType + userId to the correct polymorphic FK field
  private sessionIdField(
    userId: string,
    userType: string
  ): Record<string, string> {
    const map: Record<string, string> = {
      admin: 'adminId',
      merchant: 'merchantId',
      company_admin: 'companyAdminId',
      employee: 'employeeId',
    };
    const field = map[userType];
    return field ? { [field]: userId } : {};
  }

  // Extract user ID from a LoginSession row regardless of which FK is set
  private getSessionUserId(session: {
    adminId?: string | null;
    merchantId?: string | null;
    companyAdminId?: string | null;
    employeeId?: string | null;
  }): string | null {
    return session.adminId
      ?? session.merchantId
      ?? session.companyAdminId
      ?? session.employeeId
      ?? null;
  }
}

export const authService = new AuthService();
