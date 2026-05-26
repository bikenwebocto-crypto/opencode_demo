import { prisma } from '@/lib/prisma';
import { hash, compare } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
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
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  generateRefreshToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
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

    // Find user based on type
    const user = await this.findUserByType(email, userType);
    if (!user) return null;

    // Verify password using our wrapper
    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) return null;

    if (!user.isActive) return null;

    // Generate tokens
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      user_type: userType,
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

    // Store session
    await prisma.loginSession.create({
      data: {
        userId: user.id,
        userType,
        refreshToken,
        accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update last login
    await this.updateLastLogin(user.id, userType);

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

    // Find user
    const user = await this.findUserById(session.userId, session.userType);
    if (!user || !user.isActive) return null;

    const userType = session.userType as UserType;
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      user_type: userType,
      ...(userType === 'admin' && { admin_role: (user as any).role }),
      ...(userType === 'merchant' && { merchant_id: user.id }),
      ...((userType === 'company_admin' || userType === 'employee') && {
        company_id: (user as any).companyId,
      }),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    };

    const accessToken = this.generateAccessToken(payload);

    // Update session
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
    await prisma.loginSession.updateMany({
      where: { userId, userType, isActive: true },
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
      case 'merchant':
        await prisma.merchant.update({ where: { id: userId }, data: { lastLoginAt: now } });
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
}

export const authService = new AuthService();
