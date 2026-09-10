import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalRedemptions,
      currentPeriodRedemptions,
      prevPeriodRedemptions,
      currentPeriodDiscount,
      prevPeriodDiscount,
      currentPeriodSavings,
      prevPeriodSavings,
      activeMerchants,
      activeCompanies,
      activeOffers,
      pendingActions,
      pendingApprovals,
      recentActivity,
      allTimeAgg,   // ← replaces the two unscoped Redemption.aggregate() calls
    ] = await Promise.all([
      prisma.redemption.count(),
      prisma.redemption.count({ where: { redeemedAt: { gte: thirtyDaysAgo } } }),
      prisma.redemption.count({
        where: { redeemedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.redemption.aggregate({
        where: { redeemedAt: { gte: thirtyDaysAgo } },
        _sum: { discountAmount: true },
      }),
      prisma.redemption.aggregate({
        where: { redeemedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { discountAmount: true },
      }),
      prisma.redemption.aggregate({
        where: { redeemedAt: { gte: thirtyDaysAgo } },
        _sum: { savingsAmount: true },
      }),
      prisma.redemption.aggregate({
        where: { redeemedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { savingsAmount: true },
      }),
      prisma.merchant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.company.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.merchantOffer.count({ where: { status: 'LIVE' } }),
      prisma.actionQueueItem.count({ where: { status: 'PENDING' } }),
      prisma.actionQueueItem.findMany({
        where: { status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: { merchant: { select: { id: true, businessName: true, slug: true } } },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          admin: { select: { id: true, firstName: true, lastName: true } },
          merchant: { select: { id: true, businessName: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      // All-time totals from the per-day rollup table instead of scanning
      // every individual Redemption row — far fewer rows to sum.
      prisma.redemptionAnalytics.aggregate({
        _sum: { totalDiscount: true, totalSavings: true },
      }),
    ]);

    const currentDiscount = currentPeriodDiscount._sum.discountAmount
      ? Number(currentPeriodDiscount._sum.discountAmount) : 0;
    const prevDiscount = prevPeriodDiscount._sum.discountAmount
      ? Number(prevPeriodDiscount._sum.discountAmount) : 0;
    const currentSavings = currentPeriodSavings._sum.savingsAmount
      ? Number(currentPeriodSavings._sum.savingsAmount) : 0;
    const prevSavings = prevPeriodSavings._sum.savingsAmount
      ? Number(prevPeriodSavings._sum.savingsAmount) : 0;

    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRedemptions,
          totalDiscount: allTimeAgg._sum.totalDiscount ? Number(allTimeAgg._sum.totalDiscount) : 0,
          totalSavings: allTimeAgg._sum.totalSavings ? Number(allTimeAgg._sum.totalSavings) : 0,
          activeMerchants,
          activeCompanies,
          activeOffers,
          pendingActions,
          periodComparison: {
            redemptionsChange: calcChange(currentPeriodRedemptions, prevPeriodRedemptions),
            discountChange: calcChange(currentDiscount, prevDiscount),
            savingsChange: calcChange(currentSavings, prevSavings),
          },
        },
        pendingApprovals: pendingApprovals.map((item) => ({
          id: item.id, type: item.type, title: item.title, description: item.description,
          referenceId: item.referenceId, referenceType: item.referenceType, priority: item.priority,
          merchantName: item.merchant?.businessName ?? null, createdAt: item.createdAt,
        })),
        recentActivity: recentActivity.map((log) => ({
          id: log.id, action: log.action, entityType: log.entityType, entityId: log.entityId,
          actorName: log.admin ? `${log.admin.firstName} ${log.admin.lastName}`
            : log.merchant ? log.merchant.businessName
            : log.company ? log.company.name : 'System',
          actorType: log.actorType, createdAt: log.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}