import { prisma } from '@/lib/prisma'
import { deriveStatus } from '@/lib/redemption-status'
import type { VoucherVerificationErrorCode } from '@/types/voucher'

interface ValidationResult {
  valid: boolean
  errorCode?: VoucherVerificationErrorCode
  errorMessage?: string
  voucher?: {
    id: string
    title: string
    merchant: string
    merchantId: string
    discountValue: number
    discountType: string
    expiresAt: string | null
  }
}

async function checkVoucherExists(
  code: string,
  merchantId?: string
): Promise<ValidationResult> {
  const offer = await prisma.merchantOffer.findFirst({
    where: {
      redemptionCode: code,
      ...(merchantId ? { merchantId } : {}),
    },
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
          status: true,
        },
      },
    },
  })

  if (!offer) {
    return {
      valid: false,
      errorCode: 'VOUCHER_NOT_FOUND',
      errorMessage: 'Voucher code not found',
    }
  }

  return {
    valid: true,
    voucher: {
      id: offer.id,
      title: offer.title,
      merchant: offer.merchant.businessName,
      merchantId: offer.merchant.id,
      discountValue: Number(offer.discountValue),
      discountType: offer.offerType,
      expiresAt: offer.endDate.toISOString(),
    },
  }
}

async function checkVoucherActive(code: string): Promise<ValidationResult> {
  const offer = await prisma.merchantOffer.findFirst({
    where: { redemptionCode: code },
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  })

  if (!offer) {
    return {
      valid: false,
      errorCode: 'VOUCHER_NOT_FOUND',
      errorMessage: 'Voucher code not found',
    }
  }

  if (offer.status !== 'LIVE') {
    return {
      valid: false,
      errorCode: 'VOUCHER_INACTIVE',
      errorMessage: `Voucher is not active (status: ${offer.status})`,
    }
  }

  return {
    valid: true,
    voucher: {
      id: offer.id,
      title: offer.title,
      merchant: offer.merchant.businessName,
      merchantId: offer.merchant.id,
      discountValue: Number(offer.discountValue),
      discountType: offer.offerType,
      expiresAt: offer.endDate.toISOString(),
    },
  }
}

async function checkVoucherDates(code: string): Promise<ValidationResult> {
  const offer = await prisma.merchantOffer.findFirst({
    where: { redemptionCode: code },
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  })

  if (!offer) {
    return {
      valid: false,
      errorCode: 'VOUCHER_NOT_FOUND',
      errorMessage: 'Voucher code not found',
    }
  }

  const now = new Date()

  if (offer.startDate > now) {
    return {
      valid: false,
      errorCode: 'VOUCHER_NOT_STARTED',
      errorMessage: `Voucher is not yet valid (starts: ${offer.startDate.toISOString()})`,
    }
  }

  if (offer.endDate < now) {
    return {
      valid: false,
      errorCode: 'VOUCHER_EXPIRED',
      errorMessage: `Voucher has expired (expired: ${offer.endDate.toISOString()})`,
    }
  }

  return {
    valid: true,
    voucher: {
      id: offer.id,
      title: offer.title,
      merchant: offer.merchant.businessName,
      merchantId: offer.merchant.id,
      discountValue: Number(offer.discountValue),
      discountType: offer.offerType,
      expiresAt: offer.endDate.toISOString(),
    },
  }
}

async function checkVoucherUsageLimits(code: string): Promise<ValidationResult> {
  const offer = await prisma.merchantOffer.findFirst({
    where: { redemptionCode: code },
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  })

  if (!offer) {
    return {
      valid: false,
      errorCode: 'VOUCHER_NOT_FOUND',
      errorMessage: 'Voucher code not found',
    }
  }

  if (offer.maxRedemptions !== null && offer.maxRedemptions > 0) {
    if (offer.currentRedemptions >= offer.maxRedemptions) {
      return {
        valid: false,
        errorCode: 'VOUCHER_USAGE_LIMIT_REACHED',
        errorMessage: `Voucher usage limit reached (${offer.currentRedemptions}/${offer.maxRedemptions})`,
      }
    }
  }

  return {
    valid: true,
    voucher: {
      id: offer.id,
      title: offer.title,
      merchant: offer.merchant.businessName,
      merchantId: offer.merchant.id,
      discountValue: Number(offer.discountValue),
      discountType: offer.offerType,
      expiresAt: offer.endDate.toISOString(),
    },
  }
}

async function checkUserEligibility(
  userId: string,
  companyId?: string
): Promise<ValidationResult> {
  const employee = await prisma.employee.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    },
  })

  if (!employee) {
    return {
      valid: false,
      errorCode: 'USER_NOT_ELIGIBLE',
      errorMessage: 'User not found or not eligible',
    }
  }

  if (employee.status !== 'ACTIVE') {
    return {
      valid: false,
      errorCode: 'USER_NOT_ELIGIBLE',
      errorMessage: `User is not active (status: ${employee.status})`,
    }
  }

  return { valid: true }
}

async function checkCompanyEligibility(companyId: string): Promise<ValidationResult> {
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    include: {
      billing: true,
    },
  })

  if (!company) {
    return {
      valid: false,
      errorCode: 'COMPANY_NOT_ELIGIBLE',
      errorMessage: 'Company not found',
    }
  }

  if (company.status !== 'ACTIVE') {
    return {
      valid: false,
      errorCode: 'COMPANY_NOT_ELIGIBLE',
      errorMessage: `Company is not active (status: ${company.status})`,
    }
  }

  if (company.billing && company.billing.billingStatus === 'ON_HOLD') {
    return {
      valid: false,
      errorCode: 'COMPANY_NOT_ELIGIBLE',
      errorMessage: 'Company billing is on hold',
    }
  }

  return { valid: true }
}

async function checkMerchantEligibility(merchantId: string): Promise<ValidationResult> {
  const merchant = await prisma.merchant.findFirst({
    where: {
      id: merchantId,
      deletedAt: null,
    },
  })

  if (!merchant) {
    return {
      valid: false,
      errorCode: 'MERCHANT_NOT_ELIGIBLE',
      errorMessage: 'Merchant not found',
    }
  }

  if (merchant.status !== 'ACTIVE') {
    return {
      valid: false,
      errorCode: 'MERCHANT_NOT_ELIGIBLE',
      errorMessage: `Merchant is not active (status: ${merchant.status})`,
    }
  }

  return { valid: true }
}

export async function validateVoucher(
  code: string,
  userId: string,
  merchantId?: string,
  companyId?: string
): Promise<ValidationResult> {
  // 1. Look up Redemption record first (source of truth for issued codes)
  const redemption = await prisma.redemption.findFirst({
    where: { redemptionCode: code },
    include: {
      offer: {
        include: {
          merchant: {
            select: {
              id: true,
              businessName: true,
              status: true,
            },
          },
        },
      },
    },
  })

  if (redemption) {
    // Redemption record exists — validate against it

    // 2. Derive redemption status from stored fields
    const status = deriveStatus({
      isVerified: redemption.isVerified,
      verifiedAt: redemption.verifiedAt,
      merchantNotes: redemption.merchantNotes,
      employeeNotes: redemption.employeeNotes,
    })

    // 3. Check if already processed
    if (status === 'CONFIRMED') {
      return {
        valid: false,
        errorCode: 'ALREADY_REDEEMED',
        errorMessage: 'This code has already been redeemed',
      }
    }
    if (status === 'REJECTED') {
      return {
        valid: false,
        errorCode: 'ALREADY_REDEEMED',
        errorMessage: 'This redemption was rejected',
      }
    }
    if (status === 'CANCELLED') {
      return {
        valid: false,
        errorCode: 'ALREADY_REDEEMED',
        errorMessage: 'This redemption was cancelled',
      }
    }

    // 4. Check linked offer reference
    if (!redemption.offer) {
      return {
        valid: false,
        errorCode: 'OFFER_REFERENCE_MISSING',
        errorMessage: 'The redemption code exists, but its associated offer is no longer available. Please contact support.',
      }
    }

    // 5. Merchant ownership check — derive from offer, not redemption record
    if (merchantId && redemption.offer.merchantId !== merchantId) {
      return {
        valid: false,
        errorCode: 'MERCHANT_ACCESS_DENIED',
        errorMessage: 'You are not authorized to redeem this offer.',
      }
    }

    // 6. Check offer expiry
    const now = new Date()
    if (redemption.offer.endDate < now) {
      return {
        valid: false,
        errorCode: 'VOUCHER_EXPIRED',
        errorMessage: `Voucher has expired (expired: ${redemption.offer.endDate.toISOString()})`,
      }
    }

    // 7. Check merchant eligibility via linked offer
    const merchantResult = await checkMerchantEligibility(redemption.offer.merchantId)
    if (!merchantResult.valid) {
      return merchantResult
    }

    // All checks passed — return voucher data from the linked offer
    return {
      valid: true,
      voucher: {
        id: redemption.offer.id,
        title: redemption.offer.title,
        merchant: redemption.offer.merchant.businessName,
        merchantId: redemption.offer.merchant.id,
        discountValue: Number(redemption.offer.discountValue),
        discountType: redemption.offer.offerType,
        expiresAt: redemption.offer.endDate.toISOString(),
      },
    }
  }

  // 8. No Redemption record — fall back to offer-based validation
  const existsResult = await checkVoucherExists(code, merchantId)
  if (!existsResult.valid) {
    return existsResult
  }

  const activeResult = await checkVoucherActive(code)
  if (!activeResult.valid) {
    return activeResult
  }

  const datesResult = await checkVoucherDates(code)
  if (!datesResult.valid) {
    return datesResult
  }

  const usageResult = await checkVoucherUsageLimits(code)
  if (!usageResult.valid) {
    return usageResult
  }

  const userResult = await checkUserEligibility(userId, companyId)
  if (!userResult.valid) {
    return userResult
  }

  if (companyId) {
    const companyResult = await checkCompanyEligibility(companyId)
    if (!companyResult.valid) {
      return companyResult
    }
  }

  if (existsResult.voucher) {
    const merchantResult = await checkMerchantEligibility(existsResult.voucher.merchantId)
    if (!merchantResult.valid) {
      return merchantResult
    }
  }

  return {
    valid: true,
    voucher: existsResult.voucher,
  }
}
