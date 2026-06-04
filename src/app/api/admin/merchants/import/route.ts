import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { validateUserEmail } from '@/services/user-validation.service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'CSV file is required' } },
        { status: 400 },
      );
    }

    const text = await file.text();
    const rows: Record<string, string>[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'CSV file is empty' } },
        { status: 400 },
      );
    }

    const results: { row: number; businessName: string; success: boolean; action: string; error?: string }[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      try {
        const businessName = (row.businessName ?? '').trim();
        const email = (row.email ?? '').trim().toLowerCase();
        const contactName = (row.contactName ?? '').trim();
        const password = (row.password ?? '').trim();

        if (!businessName || !email || !contactName) {
          failed++;
          results.push({ row: i + 1, businessName: businessName || 'Unknown', success: false, action: 'failed', error: 'Missing required fields: businessName, email, contactName' });
          continue;
        }

        const existing = await prisma.merchant.findUnique({ where: { email } });
        if (existing) {
          if (!password) {
            skipped++;
            results.push({ row: i + 1, businessName, success: true, action: 'skipped', error: 'Already exists (no password provided)' });
            continue;
          }
          const passwordHash = await bcrypt.hash(password, 10);
          await prisma.merchant.update({
            where: { email },
            data: {
              passwordHash,
              contactName,
              contactPhone: (row.contactPhone ?? '').trim() || null,
              description: (row.description ?? '').trim() || null,
              website: (row.website ?? '').trim() || null,
              categoryId: (row.categoryId ?? '').trim() || null,
              addressLine1: (row.addressLine1 ?? '').trim() || null,
              addressLine2: (row.addressLine2 ?? '').trim() || null,
              city: (row.city ?? '').trim() || null,
              state: (row.state ?? '').trim() || null,
              postalCode: (row.postalCode ?? '').trim() || null,
              country: (row.country ?? '').trim() || null,
            },
          });
          imported++;
          results.push({ row: i + 1, businessName, success: true, action: 'updated' });
          continue;
        }

        const validation = await validateUserEmail(email);
        if (validation.exists) {
          failed++;
          results.push({ row: i + 1, businessName, success: false, action: 'failed', error: 'Email is already assigned to another account' });
          continue;
        }

        if (!password) {
          failed++;
          results.push({ row: i + 1, businessName, success: false, action: 'failed', error: 'Password is required for new merchants' });
          continue;
        }

        if (password.length < 8) {
          failed++;
          results.push({ row: i + 1, businessName, success: false, action: 'failed', error: 'Password must be at least 8 characters' });
          continue;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now() + '-' + i;
        const rawStatus = (row.status ?? '').trim().toUpperCase();
        const status = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].includes(rawStatus) ? rawStatus : 'PENDING';

        const accountStatus = status === 'ACTIVE' ? 'ACTIVE' : 'PENDING';

        await prisma.$transaction(async (tx) => {
          const merchant = await tx.merchant.create({
            data: {
              businessName,
              slug,
              email,
              passwordHash,
              contactName,
              contactPhone: (row.contactPhone ?? '').trim() || null,
              description: (row.description ?? '').trim() || null,
              website: (row.website ?? '').trim() || null,
              categoryId: (row.categoryId ?? '').trim() || null,
              addressLine1: (row.addressLine1 ?? '').trim() || null,
              addressLine2: (row.addressLine2 ?? '').trim() || null,
              city: (row.city ?? '').trim() || null,
              state: (row.state ?? '').trim() || null,
              postalCode: (row.postalCode ?? '').trim() || null,
              country: (row.country ?? '').trim() || null,
              status: status as any,
              onboardingStep: status === 'ACTIVE' ? 'COMPLETE' : 'APPLICATION',
            },
          });

          await tx.account.create({
            data: {
              authUserId: merchant.id,
              email,
              role: 'MERCHANT',
              profileId: merchant.id,
              profileType: 'MERCHANT',
              status: accountStatus as any,
            },
          });
        });

        imported++;
        results.push({ row: i + 1, businessName, success: true, action: 'created' });
      } catch (err: any) {
        failed++;
        results.push({ row: i + 1, businessName: row.businessName ?? 'Unknown', success: false, action: 'failed', error: err.message ?? 'Unexpected error' });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        imported,
        skipped,
        failed,
        results,
      },
      message: `${imported} imported, ${skipped} skipped, ${failed} failed`,
    });
  } catch (error: any) {
    console.error('Merchant import error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error.message ?? 'Internal server error' } },
      { status: 500 },
    );
  }
}
