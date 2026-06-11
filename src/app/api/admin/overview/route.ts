import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  try {
    // const user = await getCurrentUser();
    // console.log('Admin overview accessed by user:', user ? { id: user.id, email: user.email } : null);
    // if (!user || user.userType !== 'admin') {
    //   return NextResponse.json(
    //     { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    //     { status: 401 }
    //   );
    // }
  
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
      prisma.merchant.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      prisma.company.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      prisma.merchantOffer.count({
        where: { status: 'LIVE' },
      }),
      prisma.actionQueueItem.count({
        where: { status: 'PENDING' },
      }),
      prisma.actionQueueItem.findMany({
        where: { status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: {
          merchant: {
            select: { id: true, businessName: true, slug: true },
          },
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          admin: { select: { id: true, firstName: true, lastName: true, email: true } },
          merchant: { select: { id: true, businessName: true } },
          company: { select: { id: true, name: true } },
        },
      }),
    ]);

    const currentDiscount = currentPeriodDiscount._sum.discountAmount
      ? Number(currentPeriodDiscount._sum.discountAmount)
      : 0;
    const prevDiscount = prevPeriodDiscount._sum.discountAmount
      ? Number(prevPeriodDiscount._sum.discountAmount)
      : 0;

    const currentSavings = currentPeriodSavings._sum.savingsAmount
      ? Number(currentPeriodSavings._sum.savingsAmount)
      : 0;
    const prevSavings = prevPeriodSavings._sum.savingsAmount
      ? Number(prevPeriodSavings._sum.savingsAmount)
      : 0;

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const totalDiscountAgg = await prisma.redemption.aggregate({
      _sum: { discountAmount: true },
    });
    const totalSavingsAgg = await prisma.redemption.aggregate({
      _sum: { savingsAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRedemptions,
          totalDiscount: totalDiscountAgg._sum.discountAmount
            ? Number(totalDiscountAgg._sum.discountAmount)
            : 0,
          totalSavings: totalSavingsAgg._sum.savingsAmount
            ? Number(totalSavingsAgg._sum.savingsAmount)
            : 0,
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
          id: item.id,
          type: item.type,
          title: item.title,
          description: item.description,
          referenceId: item.referenceId,
          referenceType: item.referenceType,
          priority: item.priority,
          merchantName: item.merchant?.businessName ?? null,
          createdAt: item.createdAt,
        })),
        recentActivity: recentActivity.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          actorName: log.admin
            ? `${log.admin.firstName} ${log.admin.lastName}`
            : log.merchant
              ? log.merchant.businessName
              : log.company
                ? log.company.name
                : 'System',
          actorType: log.actorType,
          createdAt: log.createdAt,
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

