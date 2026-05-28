import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { authService } from '@/services/auth.service';
import type { LoginRequest, UserType } from '@/types';

vi.mock('bcryptjs', () => {
  const mockHash = vi.fn((pw: string) => Promise.resolve(`hashed_${pw}`));
  const mockCompare = vi.fn((pw: string, hash: string) => Promise.resolve(hash === `hashed_${pw}`));
  return { hash: mockHash, compare: mockCompare };
});

vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => Buffer.from('a'.repeat(128))),
}));

const makeMockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: 'hashed_validPass1',
  firstName: 'John',
  lastName: 'Doe',
  isActive: true,
  role: 'SUPER_ADMIN',
  ...overrides,
});

const makeLoginRequest = (overrides = {}): LoginRequest => ({
  email: 'test@example.com',
  password: 'validPass1',
  userType: 'admin',
  ...overrides,
});

function decodeToken(token: string): Record<string, unknown> {
  const parts = token.split('.');
  return JSON.parse(atob(parts[1]!));
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify a password', async () => {
      const hash = await authService.hashPassword('MyStr0ng!Pass');
      expect(hash).toBe('hashed_MyStr0ng!Pass');

      const ok = await authService.verifyPassword('MyStr0ng!Pass', hash);
      expect(ok).toBe(true);

      const nok = await authService.verifyPassword('WrongPassword', hash);
      expect(nok).toBe(false);
    });
  });

  describe('generateAccessToken / verifyAccessToken', () => {
    it('should generate a valid JWT and verify it', () => {
      const payload = { sub: 'u1', email: 'a@b.com', user_type: 'admin' as UserType, iat: 0, exp: 9999999999 };
      const token = authService.generateAccessToken(payload);

      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);

      const decoded = authService.verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.sub).toBe('u1');
      expect(decoded!.email).toBe('a@b.com');
      expect(decoded!.user_type).toBe('admin');
    });

    it('should return null for an invalid token', () => {
      expect(authService.verifyAccessToken('bad-token')).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('should produce a hex string of the correct length', () => {
      const token = authService.generateRefreshToken();
      expect(token).toHaveLength(128);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('login', () => {
    it('should return LoginResponse for valid admin credentials', async () => {
      const user = makeMockUser();
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 'sess-1' } as any);
      (prisma.adminUser as any).update = vi.fn().mockResolvedValue(user as any);

      const result = await authService.login(makeLoginRequest());

      expect(result).not.toBeNull();
      expect(result!.user.email).toBe('test@example.com');
      expect(result!.user.userType).toBe('admin');
      expect(result!.user.name).toBe('John Doe');
      expect(result!.accessToken).toBeTruthy();
      expect(result!.refreshToken).toHaveLength(128);
      expect(result!.expiresAt).toBeDefined();

      const claims = decodeToken(result!.accessToken);
      expect(claims.admin_role).toBe('SUPER_ADMIN');

      expect(prisma.loginSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ adminId: 'user-1', userType: 'admin' }),
        })
      );
    });

    it('should return LoginResponse for valid merchant credentials', async () => {
      const merchant = makeMockUser({ role: undefined, companyId: 'comp-1' });
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(merchant as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 'sess-1' } as any);
      (prisma.merchant as any).update = vi.fn().mockResolvedValue(merchant as any);

      const result = await authService.login(makeLoginRequest({ userType: 'merchant' }));

      expect(result).not.toBeNull();
      expect(result!.user.userType).toBe('merchant');
      expect(result!.user.merchantId).toBe('user-1');

      const claims = decodeToken(result!.accessToken);
      expect(claims.merchant_id).toBe('user-1');

      expect(prisma.loginSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ merchantId: 'user-1' }) })
      );
    });

    it('should return LoginResponse for valid company_admin credentials', async () => {
      const admin = makeMockUser({ company: { id: 'comp-1' }, companyId: 'comp-1', role: undefined });
      vi.mocked(prisma.companyAdmin.findUnique).mockResolvedValue(admin as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 'sess-1' } as any);
      (prisma.companyAdmin as any).update = vi.fn().mockResolvedValue(admin as any);

      const result = await authService.login(makeLoginRequest({ userType: 'company_admin' }));
      expect(result).not.toBeNull();
      expect(result!.user.userType).toBe('company_admin');

      const claims = decodeToken(result!.accessToken);
      expect(claims.company_id).toBe('comp-1');

      expect(prisma.loginSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ companyAdminId: 'user-1' }) })
      );
    });

    it('should return LoginResponse for valid employee credentials', async () => {
      const emp = makeMockUser({ company: { id: 'comp-1' }, companyId: 'comp-1', role: undefined });
      vi.mocked(prisma.employee.findUnique).mockResolvedValue(emp as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 'sess-1' } as any);
      (prisma.employee as any).update = vi.fn().mockResolvedValue(emp as any);

      const result = await authService.login(makeLoginRequest({ userType: 'employee' }));
      expect(result).not.toBeNull();
      expect(result!.user.userType).toBe('employee');

      const claims = decodeToken(result!.accessToken);
      expect(claims.company_id).toBe('comp-1');

      expect(prisma.loginSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ employeeId: 'user-1' }) })
      );
    });

    it('should return null for unknown user', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);
      const result = await authService.login(makeLoginRequest());
      expect(result).toBeNull();
    });

    it('should return null for wrong password', async () => {
      const user = makeMockUser({ passwordHash: 'hashed_otherPass' });
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(user as any);
      const result = await authService.login(makeLoginRequest({ password: 'wrongPass' }));
      expect(result).toBeNull();
    });

    it('should return null if user is inactive', async () => {
      const user = makeMockUser({ isActive: false });
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(user as any);
      const result = await authService.login(makeLoginRequest());
      expect(result).toBeNull();
    });

    it('should return null for unsupported userType', async () => {
      const result = await authService.login(makeLoginRequest({ userType: 'unknown' as UserType }));
      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    const validSession = {
      id: 'sess-1',
      refreshToken: 'valid-refresh',
      accessToken: 'old-access',
      adminId: 'user-1',
      merchantId: null,
      companyAdminId: null,
      employeeId: null,
      userType: 'admin',
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000),
      lastActivityAt: null,
    };

    it('should refresh an active session', async () => {
      vi.mocked(prisma.loginSession.findUnique).mockResolvedValue(validSession as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(makeMockUser() as any);
      vi.mocked(prisma.loginSession.update).mockResolvedValue(validSession as any);

      const result = await authService.refreshAccessToken('valid-refresh');

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBeTruthy();
      expect(prisma.loginSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({ accessToken: expect.any(String), lastActivityAt: expect.any(Date) }),
        })
      );
    });

    it('should return null if session not found', async () => {
      vi.mocked(prisma.loginSession.findUnique).mockResolvedValue(null);
      expect(await authService.refreshAccessToken('bad-token')).toBeNull();
    });

    it('should return null if session is expired', async () => {
      vi.mocked(prisma.loginSession.findUnique).mockResolvedValue({
        ...validSession, expiresAt: new Date(Date.now() - 1000),
      } as any);
      expect(await authService.refreshAccessToken('expired')).toBeNull();
    });

    it('should return null if session user ID cannot be resolved', async () => {
      vi.mocked(prisma.loginSession.findUnique).mockResolvedValue({
        ...validSession, adminId: null, merchantId: null, companyAdminId: null, employeeId: null,
      } as any);
      expect(await authService.refreshAccessToken('no-id')).toBeNull();
    });

    it('should return null if user is deleted or inactive', async () => {
      vi.mocked(prisma.loginSession.findUnique).mockResolvedValue(validSession as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);
      expect(await authService.refreshAccessToken('valid-refresh')).toBeNull();
    });
  });

  describe('logout', () => {
    it('should deactivate all sessions matching the refresh token', async () => {
      vi.mocked(prisma.loginSession.updateMany).mockResolvedValue({ count: 1 } as any);
      await authService.logout('some-refresh');
      expect(prisma.loginSession.updateMany).toHaveBeenCalledWith({
        where: { refreshToken: 'some-refresh' },
        data: { isActive: false },
      });
    });
  });

  describe('invalidateAllSessions', () => {
    it('should deactivate sessions for admin', async () => {
      vi.mocked(prisma.loginSession.updateMany).mockResolvedValue({ count: 3 } as any);
      await authService.invalidateAllSessions('admin-1', 'admin');
      expect(prisma.loginSession.updateMany).toHaveBeenCalledWith({
        where: { adminId: 'admin-1', userType: 'admin', isActive: true },
        data: { isActive: false },
      });
    });

    it('should deactivate sessions for merchant', async () => {
      vi.mocked(prisma.loginSession.updateMany).mockResolvedValue({ count: 2 } as any);
      await authService.invalidateAllSessions('merchant-1', 'merchant');
      expect(prisma.loginSession.updateMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1', userType: 'merchant', isActive: true },
        data: { isActive: false },
      });
    });

    it('should deactivate sessions for company_admin', async () => {
      vi.mocked(prisma.loginSession.updateMany).mockResolvedValue({ count: 1 } as any);
      await authService.invalidateAllSessions('ca-1', 'company_admin');
      expect(prisma.loginSession.updateMany).toHaveBeenCalledWith({
        where: { companyAdminId: 'ca-1', userType: 'company_admin', isActive: true },
        data: { isActive: false },
      });
    });

    it('should deactivate sessions for employee', async () => {
      vi.mocked(prisma.loginSession.updateMany).mockResolvedValue({ count: 5 } as any);
      await authService.invalidateAllSessions('emp-1', 'employee');
      expect(prisma.loginSession.updateMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', userType: 'employee', isActive: true },
        data: { isActive: false },
      });
    });
  });

  describe('JWT payload construction', () => {
    it('should include admin_role for admin user', async () => {
      const user = makeMockUser({ role: 'SUPER_ADMIN' });
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 's' } as any);
      (prisma.adminUser as any).update = vi.fn().mockResolvedValue(user as any);

      const result = await authService.login(makeLoginRequest());
      const claims = decodeToken(result!.accessToken);
      expect(claims.admin_role).toBe('SUPER_ADMIN');
      expect(claims.merchant_id).toBeUndefined();
      expect(claims.company_id).toBeUndefined();
    });

    it('should include merchant_id for merchant user', async () => {
      const user = makeMockUser({ role: undefined });
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 's' } as any);
      (prisma.merchant as any).update = vi.fn().mockResolvedValue(user as any);

      const result = await authService.login(makeLoginRequest({ userType: 'merchant' }));
      const claims = decodeToken(result!.accessToken);
      expect(claims.merchant_id).toBe('user-1');
      expect(claims.admin_role).toBeUndefined();
    });

    it('should include company_id for company_admin or employee', async () => {
      const user = makeMockUser({ company: { id: 'comp-1' }, companyId: 'comp-1', role: undefined });
      vi.mocked(prisma.employee.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.loginSession.create).mockResolvedValue({ id: 's' } as any);
      (prisma.employee as any).update = vi.fn().mockResolvedValue(user as any);

      const result = await authService.login(makeLoginRequest({ userType: 'employee' }));
      const claims = decodeToken(result!.accessToken);
      expect(claims.company_id).toBe('comp-1');
      expect(claims.admin_role).toBeUndefined();
    });
  });
});
