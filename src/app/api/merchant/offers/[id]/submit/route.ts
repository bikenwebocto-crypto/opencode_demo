import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMerchantFromSession } from '@/lib/merchant-session'
import { createAuditLog } from '@/services/audit-log.service';

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

  const ot = body.offerType;
  if (ot === 'flat_rate' || ot === 'fixed_amount') {
    if (body.discountValue == null || Number(body.discountValue) <= 0) {
      errors.discountValue = 'Discount value is required for flat offers';
    }
  } else if (ot === 'percentage') {
    if (body.discountPercent == null || Number(body.discountPercent) <= 0) {
      errors.discountPercent = 'Discount percentage is required for percentage offers';
    } else if (Number(body.discountPercent) > 90) {
      errors.discountPercent = 'Discount percentage cannot exceed 90%';
    }
  } else if (ot === 'buy_x_get_y') {
    if (!body.buyQuantity || Number(body.buyQuantity) <= 0) errors.buyQuantity = 'Buy quantity is required';
    if (!body.buyItem?.trim()) errors.buyItem = 'Buy item is required';
    if (!body.getQuantity || Number(body.getQuantity) <= 0) errors.getQuantity = 'Get quantity is required';
    if (!body.freeItem?.trim()) errors.freeItem = 'Free item is required';
  }

  if (!body.startDate) errors.startDate = 'Start date is required';
  if (!body.endDate) errors.endDate = 'End date is required';
  if (body.startDate && body.endDate && new Date(body.endDate) <= new Date(body.startDate)) errors.endDate = 'End date must be after start date';
  if (!body.termsAndConditions) errors.termsAndConditions = 'Terms and conditions are required';
  if (!body.categoryId) errors.categoryId = 'Category is required';
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromSession();

    if (!merchant) {
      return unauthorized();
    }

    const { id } = await params;

    const offer = await prisma.merchantOffer.findFirst({
      where: {
        id,
        merchantId: merchant.id,
        deletedAt: null,
      },
      include: {
        content: { select: { description: true, shortDescription: true, termsAndConditions: true, imageUrls: true } },
        pricing: { select: { configuration: true } },
        redemption: { select: { redemptionType: true, configuration: true } },
        review: { select: { validationErrors: true } },
      },
    });

    if (!offer) {
      return notFound();
    }

    const redemptionConfig = (offer.redemption?.configuration as Record<string, unknown>) ?? {}
    const qrCodeUrl = redemptionConfig.qrCodeUrl as string | undefined

    console.log('[SUBMIT OFFER] Start - offer:', {
      id: offer.id,
      title: offer.title,
      status: offer.status,
      redemptionType: offer.redemption?.redemptionType,
      hasQrCodeUrl: !!qrCodeUrl,
    });

    if (!['DRAFT', 'VALIDATION_FAILED', 'CHANGES_REQUESTED', 'ARCHIVED', 'AWAITING_APPROVAL'].includes(offer.status)) {
      console.log('[SUBMIT OFFER] ❌ Cannot submit, current status:', offer.status);
      return forbidden(
        'Only draft, validation-failed, or changes-requested offers can be submitted',
      );
    }

    const body = await request.json();
    console.log('[SUBMIT OFFER] Body received:', Object.keys(body));

    const pricingConfig = (offer.pricing?.configuration as Record<string, unknown>) ?? {}

    const qcResult = runQualityChecks({
      ...offer,
      ...pricingConfig,
      ...body,
      description: body.description ?? offer.content?.description,
      shortDescription: body.shortDescription ?? offer.content?.shortDescription,
      termsAndConditions: body.termsAndConditions ?? offer.content?.termsAndConditions,
      imageUrls: body.imageUrls ?? offer.content?.imageUrls,
      offerType: body.offerType ?? offer.offerType,
      discountValue:
        body.discountValue
        ?? pricingConfig.amount
        ?? pricingConfig.percent,
      discountPercent:
        body.discountPercent
        ?? pricingConfig.percent,
      buyQuantity: body.buyQuantity ?? pricingConfig.buyQuantity,
      buyItem: body.buyItem ?? pricingConfig.buyItem,
      getQuantity: body.getQuantity ?? pricingConfig.getQuantity,
      freeItem: body.freeItem ?? pricingConfig.freeItem,
    });
    console.log('[SUBMIT OFFER] qcResult.passed:', qcResult.passed);

    const targetStatus = qcResult.passed
      ? 'AWAITING_APPROVAL'
      : 'VALIDATION_FAILED';
    console.log('[SUBMIT OFFER] targetStatus:', targetStatus);

    const finalOffer = await prisma.$transaction(async (tx) => {
      // Persist content if the body includes content fields
      if (
        body.shortDescription !== undefined ||
        body.description !== undefined ||
        body.termsAndConditions !== undefined ||
        body.imageUrls !== undefined
      ) {
        await tx.offerContent.upsert({
          where: { offerId: id },
          create: {
            offerId: id,
            shortDescription: body.shortDescription ?? null,
            description: body.description ?? null,
            termsAndConditions: body.termsAndConditions ?? null,
            imageUrls: body.imageUrls ?? [],
          },
          update: {
            ...(body.shortDescription !== undefined && { shortDescription: body.shortDescription }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.termsAndConditions !== undefined && { termsAndConditions: body.termsAndConditions }),
            ...(body.imageUrls !== undefined && { imageUrls: body.imageUrls }),
          },
        });
      }

      // Persist pricing if the body includes pricing fields
      if (
        body.offerType !== undefined ||
        body.discountValue !== undefined ||
        body.discountMax !== undefined ||
        body.discountPercent !== undefined ||
        body.minimumSpend !== undefined ||
        body.buyQuantity !== undefined ||
        body.buyItem !== undefined ||
        body.getQuantity !== undefined ||
        body.freeItem !== undefined ||
        body.maxFreeItems !== undefined
      ) {
        const config = (offer.pricing?.configuration as Record<string, unknown>) ?? {};
        const pricingConfig: Record<string, unknown> = { ...config };
        if (body.discountValue !== undefined) pricingConfig.amount = Number(body.discountValue);
        if (body.discountPercent !== undefined) pricingConfig.percent = Number(body.discountPercent);
        if (body.discountMax !== undefined) pricingConfig.maximumDiscount = Number(body.discountMax);
        if (body.minimumSpend !== undefined) pricingConfig.minimumSpend = Number(body.minimumSpend);
        if (body.buyQuantity !== undefined) pricingConfig.buyQuantity = Number(body.buyQuantity);
        if (body.buyItem !== undefined) pricingConfig.buyItem = body.buyItem;
        if (body.getQuantity !== undefined) pricingConfig.getQuantity = Number(body.getQuantity);
        if (body.freeItem !== undefined) pricingConfig.freeItem = body.freeItem;
        if (body.maxFreeItems !== undefined) pricingConfig.maxFreeItems = Number(body.maxFreeItems);

        await tx.offerPricing.upsert({
          where: { offerId: id },
          create: {
            offerId: id,
            pricingType: body.offerType ?? offer.offerType,
            configuration: pricingConfig as any,
          },
          update: {
            ...(body.offerType !== undefined && { pricingType: body.offerType }),
            configuration: pricingConfig as any,
          },
        });
      }

      // Persist redemption if the body includes redemption fields
      if (
        body.redemptionType !== undefined ||
        body.redemptionCode !== undefined ||
        body.redemptionInstructions !== undefined ||
        body.bookingUrl !== undefined ||
        body.maxRedemptions !== undefined ||
        body.daysOfWeek !== undefined
      ) {
        const config = (offer.redemption?.configuration as Record<string, unknown>) ?? {};
        const redemptionConfig: Record<string, unknown> = { ...config };
        if (body.redemptionCode !== undefined) redemptionConfig.code = body.redemptionCode;
        if (body.redemptionInstructions !== undefined) redemptionConfig.instructions = body.redemptionInstructions;
        if (body.bookingUrl !== undefined) redemptionConfig.bookingUrl = body.bookingUrl;

        await tx.offerRedemption.upsert({
          where: { offerId: id },
          create: {
            offerId: id,
            redemptionType: body.redemptionType ?? null,
            configuration: Object.keys(redemptionConfig).length > 0 ? (redemptionConfig as any) : null,
            maxRedemptions: body.maxRedemptions ?? null,
            currentRedemptions: 0,
            daysOfWeek: body.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
          },
          update: {
            ...(body.redemptionType !== undefined && { redemptionType: body.redemptionType }),
            ...(Object.keys(redemptionConfig).length > 0 && { configuration: redemptionConfig as any }),
            ...(body.maxRedemptions !== undefined && { maxRedemptions: Number(body.maxRedemptions) }),
            ...(body.daysOfWeek !== undefined && {
              daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
            }),
          },
        });
      }

      // Persist core offer fields (dates, category, type)
      const merchantOfferUpdatable: Record<string, unknown> = {};
      if (body.startDate) merchantOfferUpdatable.startDate = new Date(body.startDate);
      if (body.endDate) merchantOfferUpdatable.endDate = new Date(body.endDate);
      if (body.categoryId !== undefined) merchantOfferUpdatable.categoryId = body.categoryId;
      if (body.offerType !== undefined) merchantOfferUpdatable.offerType = body.offerType;
      if (body.title !== undefined) merchantOfferUpdatable.title = body.title;

      if (Object.keys(merchantOfferUpdatable).length > 0) {
        await tx.merchantOffer.update({
          where: { id },
          data: merchantOfferUpdatable,
        });
      }

      // Update review with validation errors
      await tx.offerReview.upsert({
        where: { offerId: id },
        create: {
          offerId: id,
          validationErrors: qcResult.passed ? null : (qcResult.errors as any),
        },
        update: {
          validationErrors: qcResult.passed ? null : (qcResult.errors as any),
        },
      });

      // Update status
      const updated = await tx.merchantOffer.update({
        where: { id },
        data: {
          status: targetStatus,
          submittedAt: new Date(),
        },
        include: {
          _count: { select: { redemptions: true } },
          content: true,
          pricing: true,
          redemption: true,
          review: true,
          analytics: true,
        },
      });

      return updated;
    });

    // Post-submission actions for passing offers
    if (qcResult.passed) {
      if (offer.replacesOfferId) {
        const currentLive = await prisma.merchantOffer.findUnique({
          where: { id: offer.replacesOfferId },
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
              type: 'FIRST_OFFER_APPROVAL',
              title: `Offer Approval: ${offer.title}`,
              description: `Merchant ${merchant.businessName} submitted an offer for approval`,
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
        }
      } else {
        // Prevent duplicate queue items
        const existingItems = await prisma.actionQueueItem.findMany({
          where: { referenceId: merchant.id, type: 'FIRST_OFFER_APPROVAL', status: 'PENDING' },
        });
        const hasExisting = existingItems.some((i) => {
          const meta = i.metadata as Record<string, unknown> | null;
          return meta?.offerId === offer.id;
        });
        if (!hasExisting) {
          await prisma.actionQueueItem.create({
            data: {
              type: 'FIRST_OFFER_APPROVAL',
              title: `Offer Approval: ${offer.title}`,
              description: `Merchant ${merchant.businessName} submitted an offer for approval`,
              referenceId: merchant.id,
              referenceType: 'MERCHANT',
              status: 'PENDING',
              priority: 1,
              metadata: {
                offerId: offer.id,
              },
            },
          });
        }
      }

      // Audit log
      await createAuditLog({
        actorType: 'merchant',
        actorId: merchant.id,
        action: 'OFFER_SUBMITTED_FOR_APPROVAL',
        entityType: 'MERCHANT_OFFER',
        entityId: offer.id,
        metadata: {
          title: offer.title,
          replacesOfferId: offer.replacesOfferId ?? null,
        },
      });
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
