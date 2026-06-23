// Integration tests for voucher verification API

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/vouchers/verify/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    merchantOffer: {
      findFirst: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
    },
    company: {
      findFirst: vi.fn(),
    },
    merchant: {
      findFirst: vi.fn(),
    },
    redemption: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: vi.fn(),
}))

function createMockRequest(body: any, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/vouchers/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/vouchers/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should return 403 when employee tries to verify for another user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-456', // Different user
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should allow admin to verify for any user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        userType: 'ADMIN',
        profileId: 'admin-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: 100,
        currentRedemptions: 50,
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-456',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({
        id: 'merchant-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-456',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.valid).toBe(true)
    })
  })

  describe('Request Validation', () => {
    it('should return 400 when code is missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      const request = createMockRequest({
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 when userId is missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })
  })

  describe('Successful Verification', () => {
    it('should return valid voucher when all checks pass', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: 100,
        currentRedemptions: 50,
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({
        id: 'merchant-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.valid).toBe(true)
      expect(data.voucher).toBeDefined()
      expect(data.voucher.id).toBe('offer-123')
      expect(data.voucher.title).toBe('Test Offer')
      expect(data.voucher.merchant).toBe('Test Merchant')
    })

    it('should normalize code to uppercase', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: 100,
        currentRedemptions: 50,
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({
        id: 'merchant-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'test_code', // lowercase
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Verify that findFirst was called with uppercase code
      expect(prisma.merchantOffer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            redemptionCode: 'TEST_CODE',
          }),
        })
      )
    })
  })

  describe('Validation Failures', () => {
    it('should return VOUCHER_NOT_FOUND when code does not exist', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'INVALID_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.valid).toBe(false)
      expect(data.error.code).toBe('VOUCHER_NOT_FOUND')
    })

    it('should return VOUCHER_EXPIRED when voucher has expired', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 1)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2023-01-01'),
        endDate: pastDate,
        discountValue: 10,
        offerType: 'PERCENTAGE',
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VOUCHER_EXPIRED')
    })

    it('should return USER_NOT_ELIGIBLE when user is suspended', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: 100,
        currentRedemptions: 50,
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        status: 'SUSPENDED',
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('USER_NOT_ELIGIBLE')
    })

    it('should return OFFER_REFERENCE_MISSING when Redemption exists but linked offer is null', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        employeeId: 'user-123',
        merchantId: 'merchant-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: null,
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.valid).toBe(false)
      expect(data.error.code).toBe('OFFER_REFERENCE_MISSING')
    })

    it('should return ALREADY_REDEEMED when Redemption is CONFIRMED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        employeeId: 'user-123',
        merchantId: 'merchant-123',
        companyId: 'company-123',
        isVerified: true,
        verifiedAt: new Date(),
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'ARCHIVED',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2025-12-31'),
          discountValue: 10,
          offerType: 'PERCENTAGE',
          merchantId: 'merchant-123',
          merchant: {
            id: 'merchant-123',
            businessName: 'Test Merchant',
            status: 'ACTIVE',
          },
        },
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.valid).toBe(false)
      expect(data.error.code).toBe('ALREADY_REDEEMED')
    })

    it('should return valid when PENDING Redemption exists even if offer is ARCHIVED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        employeeId: 'user-123',
        merchantId: 'merchant-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Archived Offer',
          status: 'ARCHIVED',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2025-12-31'),
          discountValue: 10,
          offerType: 'PERCENTAGE',
          merchantId: 'merchant-123',
          merchant: {
            id: 'merchant-123',
            businessName: 'Test Merchant',
            status: 'ACTIVE',
          },
        },
      } as any)

      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({
        id: 'merchant-123',
        status: 'ACTIVE',
      } as any)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.valid).toBe(true)
      expect(data.voucher.title).toBe('Archived Offer')
    })
  })

  describe('Fraud Detection', () => {
    it('should return SUSPICIOUS_ACTIVITY when fraud detected', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      // Mock existing redemption for duplicate detection
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

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SUSPICIOUS_ACTIVITY')
      expect(data.fraudFlags).toBeDefined()
      expect(data.fraudFlags).toContain('DUPLICATE_ATTEMPT')
    })
  })

  describe('Rate Limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        companyId: 'company-123',
      } as any)

      // Make 11 requests to exceed user limit (10 per minute)
      for (let i = 0; i < 11; i++) {
        const request = createMockRequest({
          code: `CODE_${i}`,
          userId: 'user-123',
        })
        await POST(request)
      }

      const request = createMockRequest({
        code: 'CODE_11',
        userId: 'user-123',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })
  })

  describe('Audit Logging', () => {
    it('should log successful verification attempts', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: 100,
        currentRedemptions: 50,
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({
        id: 'merchant-123',
        status: 'ACTIVE',
      } as any)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'TEST_CODE',
        userId: 'user-123',
      })

      await POST(request)

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorType: 'EMPLOYEE',
            action: 'VOUCHER_VERIFICATION_ATTEMPT',
            entityType: 'voucher_verification',
            entityId: 'user-123',
          }),
        })
      )
    })

    it('should log failed verification attempts', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        userType: 'EMPLOYEE',
        profileId: 'user-123',
      } as any)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue(null)

      const request = createMockRequest({
        code: 'INVALID_CODE',
        userId: 'user-123',
      })

      await POST(request)

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorType: 'EMPLOYEE',
            action: 'VOUCHER_VERIFICATION_ATTEMPT',
            entityType: 'voucher_verification',
            entityId: 'user-123',
          }),
        })
      )
    })
  })
})
