import { prisma } from '@/lib/prisma';

/**
 * Aggregate daily redemption analytics
 * Runs via cron job or Supabase pg_cron
 *
 * Aggregates per merchant, company, and offer
 */
export async function aggregateDailyRedemptionAnalytics(date?: Date): Promise<void> {
  const targetDate = date ?? new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`[AnalyticsAggregator] Aggregating for ${startOfDay.toISOString()}`);

  // Aggregate by merchant + date
  const merchantAggs = await prisma.redemption.groupBy({
    by: ['merchantId'],
    where: {
      redeemedAt: { gte: startOfDay, lte: endOfDay },
    },
    _count: { id: true },
    _sum: { discountAmount: true, savingsAmount: true },
    _avg: { discountAmount: true },
    _count: { employeeId: true },
  });

  // For each merchant, also get unique employee count
  for (const agg of merchantAggs) {
    const uniqueEmployees = await prisma.redemption.groupBy({
      by: ['employeeId'],
      where: {
        merchantId: agg.merchantId,
        redeemedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Upsert analytics record
    await prisma.redemptionAnalytics.upsert({
      where: {
        merchantId_date: {
          merchantId: agg.merchantId,
          date: startOfDay,
        },
      },
      create: {
        merchantId: agg.merchantId,
        date: startOfDay,
        totalRedemptions: agg._count.id,
        totalDiscount: agg._sum.discountAmount ?? 0,
        totalSavings: agg._sum.savingsAmount ?? 0,
        uniqueEmployees: uniqueEmployees.length,
        averageDiscount: agg._avg.discountAmount ?? 0,
      },
      update: {
        totalRedemptions: agg._count.id,
        totalDiscount: agg._sum.discountAmount ?? 0,
        totalSavings: agg._sum.savingsAmount ?? 0,
        uniqueEmployees: uniqueEmployees.length,
        averageDiscount: agg._avg.discountAmount ?? 0,
      },
    });
  }

  console.log(
    `[AnalyticsAggregator] Aggregated ${merchantAggs.length} merchant records`
  );
}

/**
 * Aggregate running 30-day analytics for dashboard
 */
export async function aggregateRollingAnalytics(): Promise<{
  totalRedemptions: number;
  totalDiscount: number;
  totalSavings: number;
  activeMerchants: number;
  activeEmployees: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [redemptionStats, activeMerchants, activeEmployees] = await Promise.all([
    prisma.redemption.aggregate({
      where: { redeemedAt: { gte: thirtyDaysAgo } },
      _count: true,
      _sum: { discountAmount: true, savingsAmount: true },
    }),
    prisma.merchant.count({
      where: { status: 'ACTIVE', deletedAt: null },
    }),
    prisma.employee.count({
      where: { status: 'ACTIVE' },
    }),
  ]);

  return {
    totalRedemptions: redemptionStats._count,
    totalDiscount: Number(redemptionStats._sum.discountAmount ?? 0),
    totalSavings: Number(redemptionStats._sum.savingsAmount ?? 0),
    activeMerchants,
    activeEmployees,
  };
}
