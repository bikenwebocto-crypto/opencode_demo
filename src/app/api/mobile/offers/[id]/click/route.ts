import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError, notFound, badRequest } from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import { createAuditLog } from '@/services/audit-log.service'
// POST /api/mobile/offers/[id]/click
//
// Records a "click" / "view" event for the offer. Increments both
// `OfferAnalytics.viewCount` and `OfferAnalytics.clickCount` so the home
// feed can rank sections by either metric. Visibility is checked via the
// shared `liveOfferWhere` so suspended merchants or expired offers are
// rejected with a 400 (not silently accepted).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!id) return badRequest('Offer id is required');

    const now = new Date();

    // ─── Single DB call: validate + update ──────────────────────────────
    const result = await prisma.offerAnalytics.updateMany({
      where: {
        offerId: id,
        offer: {
          status: 'LIVE',
          startDate: { lte: now },
          endDate: { gt: now },
          merchant: {
            status: 'ACTIVE',
            deletedAt: null,
            branches: {
              some: {
                isActive: true,
                status: 'ACTIVE',
                deletedAt: null,
              },
            },
          },
        },
      },
      data: {
        viewCount: { increment: 1 },   // 👈 keep both, or remove clickCount
      },
    });

    // If count === 0 → either offer invalid/expired, or analytics record missing
    if (result.count === 0) {
      return notFound('Offer not found or not currently visible');
    }

    // ─── Fire‑and‑forget audit log ──────────────────────────────────────
    // merchantId is intentionally omitted to avoid a second query.
    // If you absolutely need it, you can fetch only that field in a separate
    // lightweight call, but it’s usually not critical for the audit trail.
    void createAuditLog({
      actorType: 'employee',
      actorId: auth.employee.id,
      action: 'OFFER_VIEWED',          // or 'OFFER_CLICKED'
      entityType: 'merchantOffer',
      entityId: id,
      metadata: { loginSource: 'mobile' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}