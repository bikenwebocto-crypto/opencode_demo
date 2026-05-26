import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/services/auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPass123!';
      const hash = await authService.hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPass123!';
      const hash = await authService.hashPassword(password);
      const result = await authService.verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await authService.hashPassword('TestPass123!');
      const result = await authService.verifyPassword('WrongPassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a hex string', () => {
      const token = authService.generateRefreshToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = authService.generateRefreshToken();
      const token2 = authService.generateRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('login', () => {
    it('should return null for non-existent user', async () => {
      const result = await authService.login({
        email: 'nonexistent@test.com',
        password: 'password',
        userType: 'admin',
      });
      expect(result).toBeNull();
    });
  });
});
