import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';
import { Prisma } from '@prisma/client';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Offer not found' } },
    { status: 404 },
  );
}

function forbidden(msg: string) {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: msg } },
    { status: 403 },
  );
}

function internalError(error: unknown) {
  console.error('Merchant offer submit error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

function runQualityChecks(body: any): { passed: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body.title || body.title.trim().length < 5) errors.title = 'Title must be at least 5 characters';
  if (body.title && body.title.length > 255) errors.title = 'Title must be at most 255 characters';
  if (body.description && body.description.length > 2000) errors.description = 'Description must be at most 2000 characters';
  if (body.shortDescription && body.shortDescription.length > 500) errors.shortDescription = 'Short description must be at most 500 characters';
  if (!body.offerType) errors.offerType = 'Offer type is required';
  if (body.discountValue == null || Number(body.discountValue) <= 0) errors.discountValue = 'Discount value must be a positive number';
  if (!body.startDate) errors.startDate = 'Start date is required';
  if (!body.endDate) errors.endDate = 'End date is required';
  if (body.startDate && body.endDate && new Date(body.endDate) <= new Date(body.startDate)) errors.endDate = 'End date must be after start date';
  if (!body.termsAndConditions) errors.termsAndConditions = 'Terms and conditions are required';
  if (body.imageUrls && Array.isArray(body.imageUrls)) {
    for (const url of body.imageUrls) {
      if (typeof url === 'string' && url.trim()) {
        const ext = url.split('.').pop()?.toLowerCase();
        if (!ext || !ALLOWED_IMAGE_FORMATS.includes(ext)) {
          errors.imageUrls = `Image format not supported. Allowed: ${ALLOWED_IMAGE_FORMATS.join(', ')}`;
          break;
        }
      }
    }
  }
  return { passed: Object.keys(errors).length === 0, errors };
}

async function getMerchantFromUser() {
  const user = await getCurrentUser();
  if (!user ) return null;
  return prisma.merchant.findUnique({ where: { email: user.email } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();

    if (!merchant) {
      return unauthorized();
    }

    const { id } = await params;

    const offer = await prisma.merchantOffer.findFirst({
      where: {
        id,
        merchantId: merchant.id,
      },
    });

    if (!offer) {
      return notFound();
    }

    if (!['DRAFT', 'VALIDATION_FAILED'].includes(offer.status)) {
      return forbidden(
        'Only draft or validation-failed offers can be submitted',
      );
    }

    const body = await request.json();

    const qcResult = runQualityChecks({
      ...offer,
      ...body,
    });

    const targetStatus = qcResult.passed
      ? 'VALIDATION_IN_PROGRESS'
      : 'VALIDATION_FAILED';

    let finalOffer = await prisma.merchantOffer.update({
      where: { id },
      data: {
        validationErrors: qcResult.passed
          ? null
          : qcResult.errors,
        status: targetStatus,
        submittedAt: new Date(),
      },
    });

    if (qcResult.passed && offer.replacesOfferId) {
      const currentLive = await prisma.merchantOffer.findUnique({
        where: {
          id: offer.replacesOfferId,
        },
      });

      if (currentLive?.status === 'LIVE') {
        await prisma.offerReplacementRequest.create({
          data: {
            currentOfferId: offer.replacesOfferId,
            newOfferId: offer.id,
            status: 'AWAITING_APPROVAL',
          },
        });

        await prisma.actionQueueItem.create({
          data: {
            type: 'OFFER_REPLACEMENT',
            title: `Offer Replacement: ${offer.title}`,
            description: `Merchant ${merchant.businessName} submitted a replacement offer`,
            referenceId: merchant.id,
            referenceType: 'MERCHANT',
            status: 'PENDING',
            priority: 1,
            metadata: {
              currentOfferId: offer.replacesOfferId,
              newOfferId: offer.id,
            },
          },
        });

        finalOffer = await prisma.merchantOffer.update({
          where: { id },
          data: {
            status: 'AWAITING_APPROVAL',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: finalOffer,
      qualityCheck: qcResult.passed ? 'PASSED' : 'FAILED',
      validationErrors: qcResult.errors,
    });
  } catch (error) {
    return internalError(error);
  }
}
