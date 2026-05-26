'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { issueReportSchema } from '@/schemas';

// ============================================================
// REDEMPTIONS
// ============================================================

export async function createRedemptionAction(formData: FormData) {
  const employeeId = formData.get('employeeId') as string;
  const offerId = formData.get('offerId') as string;
  const merchantId = formData.get('merchantId') as string;
  const companyId = formData.get('companyId') as string;
  const branchId = formData.get('branchId') as string | undefined;

  // Validate offer is live
  const offer = await prisma.merchantOffer.findUnique({
    where: { id: offerId, status: 'LIVE' },
  });

  if (!offer) throw new Error('Offer not found or no longer active');
  if (offer.maxRedemptions > 0 && offer.currentRedemptions >= offer.maxRedemptions) {
    throw new Error('Offer has reached maximum redemptions');
  }

  // Check employee eligibility
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId, status: 'ACTIVE' },
  });
  if (!employee) throw new Error('Employee account is not active');

  // Generate unique redemption code
  const redemptionCode = `PRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const discountAmount = Number(offer.discountValue);
  const savingsAmount = discountAmount;

  const redemption = await prisma.redemption.create({
    data: {
      merchantId,
      offerId,
      employeeId,
      companyId,
      redemptionCode,
      discountAmount,
      savingsAmount,
      branchId: branchId || null,
      redeemedAt: new Date(),
    },
  });

  // Increment offer redemption counter
  await prisma.merchantOffer.update({
    where: { id: offerId },
    data: { currentRedemptions: { increment: 1 } },
  });

  // Update merchant totals
  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      totalRedemptions: { increment: 1 },
      totalSavings: { increment: savingsAmount },
    },
  });

  revalidatePath('/employee/redemptions');
  return { success: true, redemption };
}

// ============================================================
// ISSUE REPORTS
// ============================================================

export async function reportIssueAction(formData: FormData) {
  const raw = {
    merchantId: formData.get('merchantId') as string,
    redemptionId: formData.get('redemptionId') as string | undefined,
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    category: formData.get('category') as string,
    priority: formData.get('priority') as string,
  };

  const parsed = issueReportSchema.parse(raw);

  const issue = await prisma.issueReport.create({
    data: {
      merchantId: parsed.merchantId,
      employeeId: 'system', // TODO: from auth
      redemptionId: parsed.redemptionId || null,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      priority: parsed.priority,
      status: 'OPEN',
    },
  });

  // Auto-create action queue item for admin
  await prisma.actionQueueItem.create({
    data: {
      type: 'ISSUE_REVIEW',
      title: `Issue Report: ${parsed.title}`,
      description: `New issue reported by employee. Category: ${parsed.category}`,
      referenceId: issue.id,
      referenceType: 'issue',
      status: 'PENDING',
      priority: 3,
    },
  });

  revalidatePath('/employee/profile');
  return { success: true, issue };
}

// ============================================================
// OFFERS
// ============================================================

export async function getLiveOffersAction(companyId: string, page = 1, pageSize = 20) {
  const now = new Date();

  const [offers, total] = await Promise.all([
    prisma.merchantOffer.findMany({
      where: {
        status: 'LIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        merchant: {
          status: 'ACTIVE',
          deletedAt: null,
          category: { companyId },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        merchant: {
          select: {
            id: true,
            businessName: true,
            slug: true,
            logoUrl: true,
            city: true,
            state: true,
            averageRating: true,
            categoryId: true,
            description: true,
          },
        },
      },
    }),
    prisma.merchantOffer.count({
      where: {
        status: 'LIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        merchant: { status: 'ACTIVE', deletedAt: null, category: { companyId } },
      },
    }),
  ]);

  return {
    data: offers,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total,
      hasPreviousPage: page > 1,
    },
  };
}
