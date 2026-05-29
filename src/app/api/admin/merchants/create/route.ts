import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessName, email, password, contactName, contactPhone,
      categoryId, description, website,
      addressLine1, addressLine2, city, state, postalCode, country,
    } = body;

    if (!businessName || !email || !password || !contactName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Missing required fields: businessName, email, password, contactName' } },
        { status: 400 },
      );
    }

    const existing = await prisma.merchant.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A merchant with this email already exists' } },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    const merchant = await prisma.merchant.create({
      data: {
        businessName,
        slug,
        email,
        passwordHash,
        contactName,
        contactPhone: contactPhone || null,
        categoryId: categoryId || null,
        description: description || null,
        website: website || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        country: country || null,
        status: 'PENDING',
        onboardingStep: 'DOCUMENTS',
      },
    });

    return NextResponse.json(
      { success: true, data: merchant, message: 'Merchant created successfully' },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A merchant with this email already exists' } },
        { status: 409 },
      );
    }
    console.error('Merchant create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
