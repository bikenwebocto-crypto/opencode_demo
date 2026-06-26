// Unit tests for voucher validation service

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateVoucher } from '@/lib/voucher-validation'
import { prisma } from '@/lib/prisma'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    merchantOffer: {
      findFirst: vi.fn(),
    },
    redemption: {
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
  },
}))

describe('Voucher Validation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.redemption.findFirst).mockResolvedValue(null)
  })

  describe('validateVoucher', () => {
    it('should return VOUCHER_NOT_FOUND when code does not exist', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue(null)

      const result = await validateVoucher('INVALID_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VOUCHER_NOT_FOUND')
      expect(result.errorMessage).toBe('Voucher code not found')
    })

    it('should return VOUCHER_INACTIVE when offer status is not LIVE', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'DRAFT',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2024-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VOUCHER_INACTIVE')
    })

    it('should return VOUCHER_NOT_STARTED when start date is in the future', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: futureDate,
        endDate: new Date('2027-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VOUCHER_NOT_STARTED')
    })

    it('should return VOUCHER_EXPIRED when end date is in the past', async () => {
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

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VOUCHER_EXPIRED')
    })

    it('should return VOUCHER_USAGE_LIMIT_REACHED when max redemptions reached', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: 100,
        currentRedemptions: 100,
        merchantId: 'merchant-123',
        merchant: {
          id: 'merchant-123',
          businessName: 'Test Merchant',
        },
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VOUCHER_USAGE_LIMIT_REACHED')
    })

    it('should return USER_NOT_ELIGIBLE when user is not found', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
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

      vi.mocked(prisma.employee.findFirst).mockResolvedValue(null)

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('USER_NOT_ELIGIBLE')
    })

    it('should return USER_NOT_ELIGIBLE when user is not ACTIVE', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
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

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('USER_NOT_ELIGIBLE')
    })

    it('should return COMPANY_NOT_ELIGIBLE when company is not ACTIVE', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
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
        companyId: 'company-123',
      } as any)

      vi.mocked(prisma.company.findFirst).mockResolvedValue({
        id: 'company-123',
        status: 'SUSPENDED',
        billing: null,
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123', undefined, 'company-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('COMPANY_NOT_ELIGIBLE')
    })

    it('should return COMPANY_NOT_ELIGIBLE when company billing is ON_HOLD', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
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
        companyId: 'company-123',
      } as any)

      vi.mocked(prisma.company.findFirst).mockResolvedValue({
        id: 'company-123',
        status: 'ACTIVE',
        billing: {
          billingStatus: 'ON_HOLD',
        },
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123', undefined, 'company-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('COMPANY_NOT_ELIGIBLE')
    })

    it('should return MERCHANT_NOT_ELIGIBLE when merchant is not ACTIVE', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
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
        status: 'SUSPENDED',
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('MERCHANT_NOT_ELIGIBLE')
    })

    it('should return valid when all checks pass', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
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

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(true)
      expect(result.voucher).toBeDefined()
      expect(result.voucher?.id).toBe('offer-123')
      expect(result.voucher?.title).toBe('Test Offer')
      expect(result.voucher?.merchant).toBe('Test Merchant')
    })

    it('should return OFFER_REFERENCE_MISSING when Redemption exists but linked offer is missing', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: null,
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('OFFER_REFERENCE_MISSING')
      expect(result.errorMessage).toContain('offer is no longer available')
    })

    it('should return ALREADY_REDEEMED when Redemption status is CONFIRMED', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
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
          endDate: new Date('2027-12-31'),
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

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('ALREADY_REDEEMED')
    })

    it('should return ALREADY_REDEEMED when Redemption status is REJECTED', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: 'REJECTED:Expired ID',
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'ARCHIVED',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2027-12-31'),
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

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('ALREADY_REDEEMED')
    })

    it('should return ALREADY_REDEEMED when Redemption status is CANCELLED', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: 'CANCELLED:No longer needed',
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'ARCHIVED',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2027-12-31'),
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

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('ALREADY_REDEEMED')
    })

    it('should return MERCHANT_ACCESS_DENIED when offer merchantId does not match logged-in merchant', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'LIVE',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2027-12-31'),
          discountValue: 10,
          offerType: 'PERCENTAGE',
          merchantId: 'merchant-456', // different from logged-in merchant
          merchant: {
            id: 'merchant-456',
            businessName: 'Other Merchant',
            status: 'ACTIVE',
          },
        },
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('MERCHANT_ACCESS_DENIED')
      expect(result.errorMessage).toBe('You are not authorized to redeem this offer.')
    })

    it('should return MERCHANT_ACCESS_DENIED when redemption.merchantId matches but offer.merchantId does not', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123', // matches logged-in merchant
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'LIVE',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2027-12-31'),
          discountValue: 10,
          offerType: 'PERCENTAGE',
          merchantId: 'merchant-456', // different from logged-in merchant
          merchant: {
            id: 'merchant-456',
            businessName: 'Other Merchant',
            status: 'ACTIVE',
          },
        },
      } as any)

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('MERCHANT_ACCESS_DENIED')
    })

    it('should return VOUCHER_EXPIRED when linked offer endDate has passed', async () => {
      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 1)

      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'ARCHIVED',
          startDate: new Date('2023-01-01'),
          endDate: pastDate,
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

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VOUCHER_EXPIRED')
    })

    it('should return valid when PENDING Redemption has active linked offer (even if offer is ARCHIVED)', async () => {
      vi.mocked(prisma.redemption.findFirst).mockResolvedValue({
        id: 'redemption-123',
        redemptionCode: 'TEST_CODE',
        merchantId: 'merchant-123',
        employeeId: 'user-123',
        companyId: 'company-123',
        isVerified: false,
        verifiedAt: null,
        merchantNotes: null,
        employeeNotes: null,
        redeemedAt: new Date(),
        createdAt: new Date(),
        offer: {
          id: 'offer-123',
          title: 'Test Offer',
          status: 'ARCHIVED',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2027-12-31'),
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

      const result = await validateVoucher('TEST_CODE', 'user-123', 'merchant-123')

      expect(result.valid).toBe(true)
      expect(result.voucher).toBeDefined()
      expect(result.voucher?.id).toBe('offer-123')
      expect(result.voucher?.title).toBe('Test Offer')
      expect(result.voucher?.merchant).toBe('Test Merchant')
    })

    it('should allow unlimited redemptions when maxRedemptions is null', async () => {
      vi.mocked(prisma.merchantOffer.findFirst).mockResolvedValue({
        id: 'offer-123',
        title: 'Test Offer',
        status: 'LIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
        discountValue: 10,
        offerType: 'PERCENTAGE',
        maxRedemptions: null,
        currentRedemptions: 999999,
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

      const result = await validateVoucher('TEST_CODE', 'user-123')

      expect(result.valid).toBe(true)
    })
  })
})
