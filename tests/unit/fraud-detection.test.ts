// Unit tests for fraud detection service

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectFraud, trackVerificationAttempt, clearRecentAttempts } from '@/lib/fraud-detection'
import { prisma } from '@/lib/prisma'
import type { VoucherVerificationRequest } from '@/types/voucher'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    redemption: {
      findFirst: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

describe('Fraud Detection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRecentAttempts()
  })

  describe('detectFraud', () => {
    it('should detect duplicate attempts', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      // Mock existing redemption
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        employeeId: 'user-123',
        isVerified: true,
      } as any)

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      const result = await detectFraud(request)

      expect(result.flags).toContain('DUPLICATE_ATTEMPT')
      expect(result.riskScore).toBeGreaterThan(0)
    })

    it('should detect rapid attempts', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate 11 rapid attempts
      for (let i = 0; i < 11; i++) {
        trackVerificationAttempt({
          code: `CODE_${i}`,
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceId: 'device-123',
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.flags).toContain('RAPID_ATTEMPTS')
    })

    it('should detect brute force attempts', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate 21 failed attempts
      for (let i = 0; i < 21; i++) {
        trackVerificationAttempt({
          code: `INVALID_CODE_${i}`,
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceId: 'device-123',
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.flags).toContain('BRUTE_FORCE_ATTEMPT')
      expect(result.riskScore).toBeGreaterThanOrEqual(90)
    })

    it('should detect code enumeration', async () => {
      const request: VoucherVerificationRequest = {
        code: 'ABC128',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate sequential code attempts
      const sequentialCodes = ['ABC123', 'ABC124', 'ABC125', 'ABC126', 'ABC127']
      for (const code of sequentialCodes) {
        trackVerificationAttempt({
          code,
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceId: 'device-123',
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.flags).toContain('CODE_ENUMERATION')
    })

    it('should detect excessive IP requests', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate 51 requests from same IP
      for (let i = 0; i < 51; i++) {
        trackVerificationAttempt({
          code: `CODE_${i}`,
          userId: `user-${i}`,
          ipAddress: '192.168.1.1',
          deviceId: `device-${i}`,
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.flags).toContain('EXCESSIVE_IP_REQUESTS')
    })

    it('should detect suspicious device', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate 6 different users from same device
      for (let i = 0; i < 6; i++) {
        trackVerificationAttempt({
          code: `CODE_${i}`,
          userId: `user-${i}`,
          ipAddress: '192.168.1.1',
          deviceId: 'device-123',
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.flags).toContain('SUSPICIOUS_DEVICE')
    })

    it('should detect cross-company abuse', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        companyId: 'company-456', // Different company
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      
      // User doesn't belong to the specified company
      vi.mocked(prisma.employee.findFirst).mockResolvedValue(null)

      const result = await detectFraud(request)

      expect(result.flags).toContain('CROSS_COMPANY_ABUSE')
    })

    it('should return no flags for legitimate request', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        companyId: 'company-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      const result = await detectFraud(request)

      expect(result.flags).toHaveLength(0)
      expect(result.isFraudulent).toBe(false)
      expect(result.riskScore).toBe(0)
    })

    it('should mark as fraudulent when risk score >= 70', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate brute force (90 points) + rapid attempts (40 points) = 130 points (capped at 100)
      for (let i = 0; i < 25; i++) {
        trackVerificationAttempt({
          code: `INVALID_CODE_${i}`,
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceId: 'device-123',
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.isFraudulent).toBe(true)
      expect(result.riskScore).toBeGreaterThanOrEqual(70)
    })

    it('should not mark as fraudulent when risk score < 70', async () => {
      const request: VoucherVerificationRequest = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
      }

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Simulate only rapid attempts (40 points) with non-sequential codes
      const randomCodes = ['XYZ789', 'ABC123', 'DEF456', 'GHI789', 'JKL012', 'MNO345', 'PQR678', 'STU901', 'VWX234', 'YZA567', 'BCD890']
      for (let i = 0; i < 11; i++) {
        trackVerificationAttempt({
          code: randomCodes[i],
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceId: 'device-123',
          result: 'FAILED',
          timestamp: new Date(),
        })
      }

      const result = await detectFraud(request)

      expect(result.isFraudulent).toBe(false)
      expect(result.riskScore).toBeLessThan(70)
    })
  })

  describe('trackVerificationAttempt', () => {
    it('should track attempts in memory', () => {
      const attempt = {
        code: 'TEST_CODE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceId: 'device-123',
        result: 'SUCCESS' as const,
        timestamp: new Date(),
      }

      // Should not throw
      expect(() => trackVerificationAttempt(attempt)).not.toThrow()
    })
  })
})
