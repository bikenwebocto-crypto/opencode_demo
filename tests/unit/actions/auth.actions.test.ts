import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginAction, logoutAction, forgotPasswordAction, resetPasswordAction, refreshSessionAction } from '@/actions/auth.actions';
import { authService } from '@/services/auth.service';

const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
    },
  })),
}));

vi.mock('@/services/auth.service', () => ({
  authService: {
    login: vi.fn(),
    refreshAccessToken: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    loginSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    adminUser: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe('Server Actions – Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginAction', () => {
    const validForm = new FormData();
    validForm.set('email', 'admin@example.com');
    validForm.set('password', 'P@ssw0rd');
    validForm.set('userType', 'admin');

    it('should call Supabase signIn then authService.login on valid input', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'x', refresh_token: 'y' } },
        error: null,
      });

      vi.mocked(authService.login).mockResolvedValue({
        user: { id: '1', email: 'admin@example.com', userType: 'admin', name: 'Admin', isActive: true },
        accessToken: 'x',
        refreshToken: 'y',
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      } as any);

      const result = await loginAction(validForm);

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'P@ssw0rd',
      });
      expect(authService.login).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'P@ssw0rd',
        userType: 'admin',
      });
      expect(result).toBeDefined();
      expect(result.user.email).toBe('admin@example.com');
    });

    it('should throw when Supabase auth fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(loginAction(validForm)).rejects.toThrow('Invalid credentials');
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should throw when authService.login returns null', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'x' } },
        error: null,
      });
      vi.mocked(authService.login).mockResolvedValue(null);

      await expect(loginAction(validForm)).rejects.toThrow('Authentication failed');
    });

    it('should throw Zod error on invalid form data', async () => {
      const badForm = new FormData();
      badForm.set('email', 'not-an-email');
      badForm.set('password', '');
      badForm.set('userType', 'invalid');

      await expect(loginAction(badForm)).rejects.toThrow();
    });

    it('should throw Zod error when missing userType', async () => {
      const noTypeForm = new FormData();
      noTypeForm.set('email', 'a@b.com');
      noTypeForm.set('password', 'x');

      await expect(loginAction(noTypeForm)).rejects.toThrow();
    });

    it('should throw Zod error when email is empty', async () => {
      const emptyForm = new FormData();
      emptyForm.set('email', '');
      emptyForm.set('password', 'x');
      emptyForm.set('userType', 'admin');

      await expect(loginAction(emptyForm)).rejects.toThrow(/email/i);
    });
  });

  describe('logoutAction', () => {
    it('should call supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      await logoutAction();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });

  describe('forgotPasswordAction', () => {
    it('should call supabase.auth.resetPasswordForEmail on valid input', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const form = new FormData();
      form.set('email', 'user@example.com');
      form.set('userType', 'employee');

      await forgotPasswordAction(form);
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      });
    });

    it('should throw on invalid email', async () => {
      const form = new FormData();
      form.set('email', 'bad');
      form.set('userType', 'employee');

      await expect(forgotPasswordAction(form)).rejects.toThrow();
    });

    it('should throw when Supabase returns an error', async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        error: { message: 'User not found' },
      });

      const form = new FormData();
      form.set('email', 'nobody@example.com');
      form.set('userType', 'admin');

      await expect(forgotPasswordAction(form)).rejects.toThrow('User not found');
    });
  });

  describe('resetPasswordAction', () => {
    it('should call supabase.auth.updateUser on valid input with matching passwords', async () => {
      mockUpdateUser.mockResolvedValue({ error: null });

      const form = new FormData();
      form.set('token', 'some-token');
      form.set('password', 'NewStr0ng!Pass');
      form.set('confirmPassword', 'NewStr0ng!Pass');

      await resetPasswordAction(form);
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'NewStr0ng!Pass',
      });
    });

    it('should throw when passwords do not match', async () => {
      const form = new FormData();
      form.set('token', 't');
      form.set('password', 'NewStr0ng!Pass');
      form.set('confirmPassword', 'DifferentPass1!');

      await expect(resetPasswordAction(form)).rejects.toThrow();
    });

    it('should throw when password is too weak', async () => {
      const form = new FormData();
      form.set('token', 't');
      form.set('password', 'short');
      form.set('confirmPassword', 'short');

      await expect(resetPasswordAction(form)).rejects.toThrow();
    });

    it('should throw when Supabase update fails', async () => {
      mockUpdateUser.mockResolvedValue({
        error: { message: 'Password too common' },
      });

      const form = new FormData();
      form.set('token', 't');
      form.set('password', 'NewStr0ng!Pass');
      form.set('confirmPassword', 'NewStr0ng!Pass');

      await expect(resetPasswordAction(form)).rejects.toThrow('Password too common');
    });
  });

  describe('refreshSessionAction', () => {
    it('should return null when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const result = await refreshSessionAction();
      expect(result).toBeNull();
    });

    it('should return null when no refresh_token in session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { refresh_token: null } },
      });
      const result = await refreshSessionAction();
      expect(result).toBeNull();
    });

    it('should call authService.refreshAccessToken with the refresh token', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { refresh_token: 'rt-123' } },
      });
      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        user: { id: '1', email: 'a@b.com' },
        accessToken: 'new-at',
        refreshToken: 'rt-123',
        expiresAt: new Date().toISOString(),
      } as any);

      const result = await refreshSessionAction();
      expect(result).not.toBeNull();
      expect(authService.refreshAccessToken).toHaveBeenCalledWith('rt-123');
    });
  });
});
