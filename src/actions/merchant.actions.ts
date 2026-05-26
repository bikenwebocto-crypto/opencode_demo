'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { offerSchema, branchSchema } from '@/schemas';
import slugify from 'slugify';
import type { OfferStatus } from '@/types';

// ============================================================
// OFFER MANAGEMENT
// ============================================================

export async function createOfferAction(merchantId: string, formData: FormData) {
  const raw = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    shortDescription: formData.get('shortDescription') as string,
    termsAndConditions: formData.get('termsAndConditions') as string,
    offerType: formData.get('offerType') as string,
    discountValue: formData.get('discountValue') as string,
    discountMax: formData.get('discountMax') as string,
    discountPercent: formData.get('discountPercent') as string,
    minimumSpend: formData.get('minimumSpend') as string,
    maxRedemptions: formData.get('maxRedemptions') as string,
    startDate: formData.get('startDate') as string,
    endDate: formData.get('endDate') as string,
    daysOfWeek: JSON.parse((formData.get('daysOfWeek') as string) ?? '[0,1,2,3,4,5,6]'),
    isFeatured: formData.get('isFeatured') === 'true',
    isExclusive: formData.get('isExclusive') === 'true',
    redemptionCode: formData.get('redemptionCode') as string,
    redemptionInstructions: formData.get('redemptionInstructions') as string,
  };

  const parsed = offerSchema.parse(raw);

  // Check one-live-offer rule
  if (parsed.isFeatured || parsed.isExclusive) {
    const existingLive = await prisma.merchantOffer.findFirst({
      where: {
        merchantId,
        status: 'LIVE',
        endDate: { gte: new Date() },
      },
    });

    if (existingLive) {
      throw new Error('You already have a live offer. Submit a replacement request instead.');
    }
  }

  const offer = await prisma.merchantOffer.create({
    data: {
      merchantId,
      ...parsed,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
      status: 'PENDING_APPROVAL',
      submittedAt: new Date(),
      currentRedemptions: 0,
    },
  });

  // Update merchant's last offer submission date
  await prisma.merchant.update({
    where: { id: merchantId },
    data: { lastOfferSubmitAt: new Date() },
  });

  revalidatePath('/merchant/offers');
  return { success: true, offer };
}

export async function submitReplacementOfferAction(
  merchantId: string,
  currentOfferId: string,
  formData: FormData
) {
  const newOfferData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    shortDescription: formData.get('shortDescription') as string,
    termsAndConditions: formData.get('termsAndConditions') as string,
    offerType: formData.get('offerType') as string,
    discountValue: formData.get('discountValue') as string,
    discountMax: formData.get('discountMax') as string,
    discountPercent: formData.get('discountPercent') as string,
    minimumSpend: formData.get('minimumSpend') as string,
    maxRedemptions: formData.get('maxRedemptions') as string,
    startDate: formData.get('startDate') as string,
    endDate: formData.get('endDate') as string,
    daysOfWeek: JSON.parse((formData.get('daysOfWeek') as string) ?? '[0,1,2,3,4,5,6]'),
    isFeatured: formData.get('isFeatured') === 'true',
    isExclusive: formData.get('isExclusive') === 'true',
    redemptionCode: formData.get('redemptionCode') as string,
    redemptionInstructions: formData.get('redemptionInstructions') as string,
  };

  const parsed = offerSchema.parse(newOfferData);

  // Create new offer as draft
  const newOffer = await prisma.merchantOffer.create({
    data: {
      merchantId,
      ...parsed,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
      status: 'DRAFT',
    },
  });

  // Create replacement request
  await prisma.offerReplacementRequest.create({
    data: {
      currentOfferId,
      newOfferId: newOffer.id,
      reason: formData.get('replacementReason') as string,
    },
  });

  // Auto-create action queue item for admin
  const currentOffer = await prisma.merchantOffer.findUnique({ where: { id: currentOfferId } });
  await prisma.actionQueueItem.create({
    data: {
      type: 'OFFER_REPLACEMENT',
      title: `Offer Replacement: ${currentOffer?.title}`,
      description: `Merchant requests to replace offer "${currentOffer?.title}" with a new offer.`,
      referenceId: newOffer.id,
      referenceType: 'offer',
      status: 'PENDING',
      priority: 2,
    },
  });

  revalidatePath('/merchant/offers');
  return { success: true, newOffer };
}

export async function updateOfferStatusAction(offerId: string, status: OfferStatus) {
  const offer = await prisma.merchantOffer.update({
    where: { id: offerId },
    data: { status: status as any },
  });

  revalidatePath('/merchant/offers');
  return { success: true, offer };
}

// ============================================================
// BRANCH MANAGEMENT
// ============================================================

export async function createBranchAction(merchantId: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    addressLine1: formData.get('addressLine1') as string,
    addressLine2: formData.get('addressLine2') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    postalCode: formData.get('postalCode') as string,
    country: formData.get('country') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    latitude: formData.get('latitude') as string,
    longitude: formData.get('longitude') as string,
  };

  const parsed = branchSchema.parse(raw);

  const branch = await prisma.merchantBranch.create({
    data: {
      merchantId,
      ...parsed,
      latitude: parsed.latitude ? Number(parsed.latitude) : null,
      longitude: parsed.longitude ? Number(parsed.longitude) : null,
    },
  });

  revalidatePath('/merchant/branches');
  return { success: true, branch };
}

export async function deleteBranchAction(branchId: string) {
  await prisma.merchantBranch.update({
    where: { id: branchId },
    data: { isActive: false },
  });

  revalidatePath('/merchant/branches');
  return { success: true };
}

// ============================================================
// PROFILE
// ============================================================

export async function submitProfileEditRequestAction(merchantId: string, formData: FormData) {
  const requestedFields = JSON.parse(formData.get('requestedFields') as string);

  const request = await prisma.merchantProfileEditRequest.create({
    data: {
      merchantId,
      requestedFields,
      reason: formData.get('reason') as string,
    },
  });

  revalidatePath('/merchant/profile');
  return { success: true, request };
}
