import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data in dependency order
  await prisma.$transaction([
    prisma.renewalGamingAlert.deleteMany(),
    prisma.realtimeEvent.deleteMany(),
    prisma.emailVerificationToken.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.loginSession.deleteMany(),
    prisma.notificationEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.cSVRejectedRow.deleteMany(),
    prisma.cSVUploadJob.deleteMany(),
    prisma.mostPopularMerchant.deleteMany(),
    prisma.weeklyPick.deleteMany(),
    prisma.heroBanner.deleteMany(),
    prisma.actionQueueItem.deleteMany(),
    prisma.issueReport.deleteMany(),
    prisma.redemptionAnalytics.deleteMany(),
    prisma.redemption.deleteMany(),
    prisma.offerReplacementRequest.deleteMany(),
    prisma.merchantProfileEditRequest.deleteMany(),
    prisma.merchantOffer.deleteMany(),
    prisma.merchantBranch.deleteMany(),
    prisma.merchantStatusHistory.deleteMany(),
    prisma.merchant.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.companyAdmin.deleteMany(),
    prisma.companyBilling.deleteMany(),
    prisma.companyStatusHistory.deleteMany(),
    prisma.company.deleteMany(),
    prisma.adminUser.deleteMany(),
    prisma.account.deleteMany(),
    prisma.category.deleteMany(),
    prisma.platformSettings.deleteMany(),
  ]);

  const pw = await hashPassword('Test@123456');

  // ── Admins ────────────────────────────────────────────
  const superAdmin = await prisma.adminUser.create({
    data: {
      email: 'admin@perks.com',
      passwordHash: pw,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  await prisma.account.create({
    data: { authUserId: superAdmin.id, email: 'admin@perks.com', role: 'SUPER_ADMIN', profileId: superAdmin.id, profileType: 'ADMIN', status: 'ACTIVE' },
  });

  const supportAdmin = await prisma.adminUser.create({
    data: {
      email: 'support@perks.com',
      passwordHash: pw,
      firstName: 'Support',
      lastName: 'Agent',
      role: 'SUPPORT_ADMIN',
      isActive: true,
    },
  });
  await prisma.account.create({
    data: { authUserId: supportAdmin.id, email: 'support@perks.com', role: 'SUPER_ADMIN', profileId: supportAdmin.id, profileType: 'ADMIN', status: 'ACTIVE' },
  });

  const financeAdmin = await prisma.adminUser.create({
    data: {
      email: 'finance@perks.com',
      passwordHash: pw,
      firstName: 'Finance',
      lastName: 'Admin',
      role: 'FINANCE_ADMIN',
      isActive: true,
    },
  });
  await prisma.account.create({
    data: { authUserId: financeAdmin.id, email: 'finance@perks.com', role: 'SUPER_ADMIN', profileId: financeAdmin.id, profileType: 'ADMIN', status: 'ACTIVE' },
  });

  // ── Companies ─────────────────────────────────────────
  const techCorp = await prisma.company.create({
    data: {
      name: 'TechCorp Inc.',
      slug: 'techcorp-inc',
      email: 'admin@techcorp.com',
      phone: '+1-555-0100',
      website: 'https://techcorp.com',
      employeeCount: 245,
      status: 'ACTIVE',
      addressLine1: '100 Tech Boulevard',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
      industry: 'Technology',
      approvedDomain: 'techcorp.com',
      approvedAt: new Date('2025-06-01'),
    },
  });

  const globalSolutions = await prisma.company.create({
    data: {
      name: 'Global Solutions Ltd',
      slug: 'global-solutions-ltd',
      email: 'admin@globalsolutions.com',
      phone: '+1-555-0200',
      website: 'https://globalsolutions.com',
      employeeCount: 89,
      status: 'ACTIVE',
      industry: 'Consulting',
      approvedDomain: 'globalsolutions.com',
      addressLine1: '200 Park Avenue',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'United States',
      approvedAt: new Date('2025-08-15'),
    },
  });

  const innovateX = await prisma.company.create({
    data: {
      name: 'InnovateX',
      slug: 'innovatex',
      email: 'hello@innovatex.io',
      phone: '+1-555-0300',
      website: 'https://innovatex.io',
      employeeCount: 512,
      status: 'ACTIVE',
      industry: 'Technology',
      approvedDomain: 'innovatex.io',
      addressLine1: '50 Innovation Drive',
      city: 'Austin',
      state: 'TX',
      postalCode: '73301',
      country: 'United States',
      approvedAt: new Date('2025-03-20'),
    },
  });

  const blueOcean = await prisma.company.create({
    data: {
      name: 'BlueOcean Corp',
      slug: 'blueocean-corp',
      email: 'contact@blueocean.com',
      phone: '+1-555-0400',
      employeeCount: 34,
      status: 'PAUSED',
      industry: 'Logistics',
      addressLine1: '10 Harbor Lane',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'United States',
    },
  });

  const northStar = await prisma.company.create({
    data: {
      name: 'NorthStar Enterprises',
      slug: 'northstar-enterprises',
      email: 'admin@northstar.com',
      phone: '+1-555-0500',
      website: 'https://northstar.com',
      employeeCount: 178,
      status: 'ACTIVE',
      industry: 'Retail',
      approvedDomain: 'northstar.com',
      addressLine1: '88 North Pole Road',
      city: 'Denver',
      state: 'CO',
      postalCode: '80201',
      country: 'United States',
      approvedAt: new Date('2025-09-22'),
    },
  });

  // ── Company Billing ──────────────────────────────────
  await prisma.companyBilling.createMany({
    data: [
      { companyId: techCorp.id, plan: 'enterprise', billingEmail: 'billing@techcorp.com', pricePerEmployee: 8.0, isTrial: false, billingStatus: 'ACTIVE', renewalDate: new Date('2027-01-01') },
      { companyId: globalSolutions.id, plan: 'growth', billingEmail: 'billing@globalsolutions.com', pricePerEmployee: 5.0, isTrial: false, billingStatus: 'ACTIVE', renewalDate: new Date('2026-12-01') },
      { companyId: innovateX.id, plan: 'enterprise', billingEmail: 'billing@innovatex.io', pricePerEmployee: 8.0, isTrial: false, billingStatus: 'INVOICE_OVERDUE', renewalDate: new Date('2026-06-15') },
      { companyId: northStar.id, plan: 'growth', billingEmail: 'billing@northstar.com', pricePerEmployee: 5.0, isTrial: true, billingStatus: 'ACTIVE', trialEndsAt: new Date('2026-07-01'), renewalDate: new Date('2026-07-01') },
    ],
  });

  // ── Company Admins ──────────────────────────────────
  const companyAdminInputs = [
    { companyId: techCorp.id, email: 'john@techcorp.com', firstName: 'John', lastName: 'Doe' },
    { companyId: globalSolutions.id, email: 'jane@globalsolutions.com', firstName: 'Jane', lastName: 'Smith' },
    { companyId: innovateX.id, email: 'bob@innovatex.io', firstName: 'Bob', lastName: 'Johnson' },
    { companyId: blueOcean.id, email: 'alice@blueocean.com', firstName: 'Alice', lastName: 'Williams' },
    { companyId: northStar.id, email: 'charlie@northstar.com', firstName: 'Charlie', lastName: 'Brown' },
  ];
  for (const ca of companyAdminInputs) {
    const admin = await prisma.companyAdmin.create({
      data: { ...ca, passwordHash: pw, isPrimary: true, isActive: true },
    });
    await prisma.account.create({
      data: { authUserId: admin.id, email: ca.email, role: 'COMPANY_ADMIN', profileId: admin.id, profileType: 'COMPANY', status: 'ACTIVE' },
    });
  }

  // ── Categories per Company ──────────────────────────
  const catData: { companyId: string; name: string; slug: string; description?: string; icon?: string; displayOrder: number }[] = [];
  const companies = [techCorp, globalSolutions, innovateX, northStar];
  const catNames = ['Food & Dining', 'Retail', 'Technology', 'Health & Fitness', 'Entertainment', 'Travel'];
  for (const company of companies) {
    catNames.forEach((name, i) => {
      catData.push({
        companyId: company.id,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon: ['utensils', 'shopping-bag', 'laptop', 'heart', 'film', 'plane'][i],
        displayOrder: i,
      });
    });
  }
  await prisma.category.createMany({ data: catData });

  const allCategories = await prisma.category.findMany();

  // ── Employees ────────────────────────────────────────
  const companyEmployeeData: { company: typeof techCorp; prefix: string; count: number; statuses: string[] }[] = [
    { company: techCorp, prefix: 'techcorp', count: 12, statuses: ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'ACTIVE', 'ACTIVE', 'INVITED', 'ACTIVE'] },
    { company: globalSolutions, prefix: 'globalsol', count: 6, statuses: ['ACTIVE', 'ACTIVE', 'INACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE'] },
    { company: innovateX, prefix: 'innovatex', count: 10, statuses: ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INVITED', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'ACTIVE'] },
    { company: northStar, prefix: 'northstar', count: 8, statuses: ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'ACTIVE'] },
  ];

  const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo'];
  const lastNames = ['Johnson', 'Smith', 'Davis', 'Wilson', 'Martinez', 'Lee', 'Kim', 'Brown', 'Taylor', 'Anderson', 'Thomas', 'Clark'];
  const depts = ['Engineering', 'Marketing', 'Sales', 'Design', 'Finance', 'HR', 'Operations', 'Support'];

  const allEmployees: Awaited<ReturnType<typeof prisma.employee.create>>[] = [];

  for (const { company, prefix, count, statuses } of companyEmployeeData) {
    for (let i = 0; i < count; i++) {
      const emp = await prisma.employee.create({
        data: {
          companyId: company.id,
          email: `${prefix}.emp${i + 1}@${company.slug}.com`,
          passwordHash: pw,
          firstName: firstNames[i % firstNames.length]!,
          lastName: lastNames[i % lastNames.length]!,
          employeeId: `EMP-${prefix.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
          department: depts[i % depts.length]!,
          status: statuses[i] as any,
          joinMethod: statuses[i] === 'INVITED' ? 'invite' : 'csv_import',
          invitedAt: statuses[i] === 'INVITED' ? new Date() : undefined,
          invitedBy: supportAdmin.id,
        },
      });
      await prisma.account.create({
        data: {
          authUserId: emp.id,
          email: `${prefix}.emp${i + 1}@${company.slug}.com`,
          role: 'EMPLOYEE',
          profileId: emp.id,
          profileType: 'EMPLOYEE',
          status: statuses[i] === 'INVITED' ? 'PENDING' : 'ACTIVE',
        },
      });
      allEmployees.push(emp);
    }
  }

  // ── Merchants ────────────────────────────────────────
  const merchantInputs = [
    { businessName: "Joe's Coffee Shop", slug: 'joes-coffee-shop', email: 'joe@coffee.com', contactName: 'Joe Brewster', contactPhone: '+1-555-1001', category: 'Food & Dining', status: 'ACTIVE' as const, city: 'San Francisco', state: 'CA' },
    { businessName: 'TechGadgets Pro', slug: 'techgadgets-pro', email: 'info@techgadgets.com', contactName: 'Tina Chen', contactPhone: '+1-555-1002', category: 'Technology', status: 'ACTIVE' as const, city: 'San Francisco', state: 'CA' },
    { businessName: 'GreenLeaf Bistro', slug: 'greenleaf-bistro', email: 'hello@greenleaf.com', contactName: 'Mark Green', contactPhone: '+1-555-1003', category: 'Food & Dining', status: 'ACTIVE' as const, city: 'Austin', state: 'TX' },
    { businessName: 'Fashion Hub', slug: 'fashion-hub', email: 'support@fashionhub.com', contactName: 'Fiona Fashion', contactPhone: '+1-555-1004', category: 'Retail', status: 'PAUSED' as const, city: 'New York', state: 'NY' },
    { businessName: 'HealthFirst Pharmacy', slug: 'healthfirst-pharmacy', email: 'care@healthfirst.com', contactName: 'Hank Healer', contactPhone: '+1-555-1005', category: 'Health & Fitness', status: 'SUSPENDED' as const, city: 'Denver', state: 'CO' },
    { businessName: 'BookWorm Store', slug: 'bookworm-store', email: 'info@bookworm.com', contactName: 'Bella Reader', contactPhone: '+1-555-1006', category: 'Retail', status: 'ACTIVE' as const, city: 'Seattle', state: 'WA' },
    { businessName: 'Pizza Palace', slug: 'pizza-palace', email: 'orders@pizzapalace.com', contactName: 'Peter Pepperoni', contactPhone: '+1-555-1007', category: 'Food & Dining', status: 'ACTIVE' as const, city: 'New York', state: 'NY' },
    { businessName: 'FitZone Gym', slug: 'fitzone-gym', email: 'info@fitzone.com', contactName: 'Mike Johnson', contactPhone: '+1-555-1008', category: 'Health & Fitness', status: 'PENDING' as const, city: 'Austin', state: 'TX' },
    { businessName: 'Sunset Bakery', slug: 'sunset-bakery', email: 'sarah@sunsetbakery.com', contactName: 'Sarah Lee', contactPhone: '+1-555-1009', category: 'Food & Dining', status: 'PENDING' as const, city: 'Denver', state: 'CO' },
    { businessName: 'CodeCamp Academy', slug: 'codecamp-academy', email: 'david@codecamp.io', contactName: 'David Kim', contactPhone: '+1-555-1010', category: 'Technology', status: 'PENDING' as const, city: 'San Francisco', state: 'CA' },
  ];

  const createdMerchants: Awaited<ReturnType<typeof prisma.merchant.create>>[] = [];

  for (const m of merchantInputs) {
    const cat = allCategories.find((c) => c.name === m.category && c.companyId === techCorp.id);
    const merchant = await prisma.merchant.create({
      data: {
        businessName: m.businessName,
        slug: m.slug,
        email: m.email,
        passwordHash: pw,
        contactName: m.contactName,
        contactPhone: m.contactPhone,
        categoryId: cat?.id ?? allCategories[0]!.id,
        status: m.status,
        onboardingStep: m.status === 'PENDING' ? 'APPLICATION' : 'COMPLETE',
        isFeatured: ['ACTIVE', 'ACTIVE'].includes(m.status) && Math.random() > 0.6,
        isTopRated: m.status === 'ACTIVE' && Math.random() > 0.7,
        averageRating: m.status === 'ACTIVE' ? Math.round((3 + Math.random() * 2) * 10) / 10 : 0,
        totalRedemptions: m.status === 'ACTIVE' ? Math.floor(Math.random() * 500) : 0,
        totalSavings: m.status === 'ACTIVE' ? Math.floor(Math.random() * 50000) : 0,
        addressLine1: `123 ${m.businessName} St`,
        city: m.city,
        state: m.state,
        postalCode: '10001',
        country: 'United States',
        tags: [m.category.toLowerCase().replace(/[^a-z]+/g, '-')],
        approvedAt: m.status !== 'PENDING' ? new Date('2025-06-01') : undefined,
      },
    });
    await prisma.account.create({
      data: {
        authUserId: merchant.id,
        email: m.email,
        role: 'MERCHANT',
        profileId: merchant.id,
        profileType: 'MERCHANT',
        status: m.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
      },
    });
    createdMerchants.push(merchant);
  }

  // ── Merchant Branches ────────────────────────────────
  for (const merchant of createdMerchants.filter((m) => m.status !== 'PENDING')) {
    await prisma.merchantBranch.create({
      data: {
        merchantId: merchant.id,
        name: `${merchant.businessName} - Main Branch`,
        addressLine1: merchant.addressLine1 ?? '123 Main St',
        city: merchant.city ?? 'San Francisco',
        state: merchant.state ?? 'CA',
        postalCode: '10001',
        country: 'United States',
        phone: merchant.contactPhone,
        email: merchant.email,
        isActive: true,
      },
    });
  }

  // ── Merchant Offers ──────────────────────────────────
  const activeMerchants = createdMerchants.filter((m) => m.status === 'ACTIVE');
  const offerTemplates = [
    { title: '20% Off Everything', description: 'Get 20% off your entire purchase with no minimum spend.', offerType: 'percentage', discountValue: 20, discountPercent: 20 },
    { title: 'Buy 1 Get 1 Free', description: 'Buy any one item and get another of equal or lesser value for free.', offerType: 'buy_x_get_y', discountValue: 100 },
    { title: '$10 Off Any Order', description: 'Save $10 on any order over $50. Use code at checkout.', offerType: 'fixed_amount', discountValue: 10, minimumSpend: 50 },
    { title: 'Free Delivery', description: 'Free delivery on all orders this month. No code needed.', offerType: 'flat_rate', discountValue: 0 },
    { title: '15% Student Discount', description: 'Students save 15% with valid ID. Cannot be combined with other offers.', offerType: 'percentage', discountValue: 15, discountPercent: 15 },
  ];

  for (const merchant of activeMerchants) {
    for (let i = 0; i < offerTemplates.length; i++) {
      const tmpl = offerTemplates[i]!;
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2027-01-01');
      await prisma.merchantOffer.create({
        data: {
          merchantId: merchant.id,
          title: `${tmpl.title} at ${merchant.businessName}`,
          description: tmpl.description,
          shortDescription: tmpl.title,
          offerType: tmpl.offerType,
          discountValue: tmpl.discountValue,
          discountPercent: tmpl.discountPercent ?? null,
          minimumSpend: (tmpl as any).minimumSpend ?? null,
          maxRedemptions: 1000,
          currentRedemptions: Math.floor(Math.random() * 200),
          viewCount: Math.floor(Math.random() * 1500),
          saveCount: Math.floor(Math.random() * 300),
          startDate,
          endDate,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          isFeatured: i === 0,
          status: 'LIVE',
          submittedAt: startDate,
          liveAt: startDate,
        },
      });
    }
  }

  // ── Offers for PENDING merchants ────────────────────
  const pendingMerchant = createdMerchants.find((m) => m.slug === 'fitzone-gym');
  if (pendingMerchant) {
    await prisma.merchantOffer.create({
      data: {
        merchantId: pendingMerchant.id,
        title: 'Free Personal Training Session',
        description: 'New members get a free personal training session. Sign up today!',
        offerType: 'flat_rate',
        discountValue: 0,
        maxRedemptions: 500,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-12-31'),
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        status: 'PENDING_APPROVAL',
        submittedAt: new Date('2026-05-27'),
      },
    });
  }

  // ── Redemptions ──────────────────────────────────────
  const techCorpEmployees = allEmployees.filter((e) => e.companyId === techCorp.id);
  const firstMerchant = activeMerchants[0]!;
  const firstOffers = await prisma.merchantOffer.findMany({
    where: { merchantId: firstMerchant.id, status: 'LIVE' },
    take: 3,
  });

  for (let i = 0; i < 30; i++) {
    const emp = techCorpEmployees[i % techCorpEmployees.length]!;
    const offer = firstOffers[i % firstOffers.length]!;
    const discount = 5 + Math.floor(Math.random() * 45);
    const savings = discount + Math.floor(Math.random() * 20);
    const redeemedAt = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000));
    await prisma.redemption.create({
      data: {
        merchantId: firstMerchant.id,
        offerId: offer.id,
        employeeId: emp.id,
        companyId: techCorp.id,
        redemptionCode: `RED-${String(i + 1).padStart(6, '0')}`,
        discountAmount: discount,
        spentAmount: 30 + Math.floor(Math.random() * 70),
        savingsAmount: savings,
        isVerified: Math.random() > 0.3,
        redeemedAt,
      },
    });
  }

  // ── Action Queue Items ──────────────────────────────
  const pendingMerchants = createdMerchants.filter((m) => m.status === 'PENDING');
  for (const pm of pendingMerchants) {
    await prisma.actionQueueItem.create({
      data: {
        type: 'MERCHANT_APPROVAL',
        title: `Approve merchant: ${pm.businessName}`,
        description: `New merchant registration from ${pm.email} — review and approve their application.`,
        referenceId: pm.id,
        referenceType: 'merchant',
        status: 'PENDING',
        priority: 1,
      },
    });
  }

  // Offer approval items (referenceId points to merchant FK, referenceType distinguishes entity)
  const pendingOffers = await prisma.merchantOffer.findMany({
    where: { status: 'PENDING_APPROVAL' },
  });
  for (const po of pendingOffers) {
    const merchant = createdMerchants.find((m) => m.id === po.merchantId);
    if (!merchant) continue;
    await prisma.actionQueueItem.create({
      data: {
        type: 'OFFER_APPROVAL',
        title: `Approve offer: ${po.title}`,
        description: `New offer submitted by ${merchant.businessName} — review and approve.`,
        referenceId: merchant.id,
        referenceType: 'offer',
        status: 'PENDING',
        priority: 0,
      },
    });
  }

  // ── Audit Logs ──────────────────────────────────────
  const auditActions = [
    { action: 'MERCHANT_APPROVED', entityType: 'merchant' },
    { action: 'MERCHANT_CREATED', entityType: 'merchant' },
    { action: 'COMPANY_ACTIVATED', entityType: 'company' },
    { action: 'OFFER_CREATED', entityType: 'offer' },
    { action: 'OFFER_APPROVED', entityType: 'offer' },
    { action: 'EMPLOYEE_IMPORTED', entityType: 'employee' },
    { action: 'MERCHANT_SUSPENDED', entityType: 'merchant' },
    { action: 'COMPANY_CREATED', entityType: 'company' },
  ];

  for (let i = 0; i < 20; i++) {
    const entry = auditActions[Math.floor(Math.random() * auditActions.length)]!;
    const refMerchant = createdMerchants[i % createdMerchants.length]!;
    const refCompany = companies[i % companies.length]!;
    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: superAdmin.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityType === 'merchant' ? refMerchant.id : refCompany.id,
        changes: {},
        metadata: {},
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
      },
    });
  }

  // ── Issue Reports ───────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const emp = techCorpEmployees[i]!;
    await prisma.issueReport.create({
      data: {
        merchantId: firstMerchant.id,
        employeeId: emp.id,
        title: ['Redemption not honored', 'Discount not applied', 'Wrong amount charged'][i] ?? '',
        description: ([
          'The merchant refused to honor the discount code at checkout.',
          'The discount was not applied even though I showed the offer.',
          'The amount charged was higher than expected by $10.',
        ][i] ?? ''),
        category: 'redemption',
        priority: i === 0 ? 'high' : 'normal',
        status: i === 0 ? 'OPEN' : 'UNDER_REVIEW',
        adminId: i === 1 ? superAdmin.id : undefined,
        adminNotes: i === 1 ? 'Contacting merchant for details.' : undefined,
      },
    });
  }

  // ── Hero Banners ────────────────────────────────────
  const activeMerchantIds = activeMerchants.map((m) => m.id);
  await prisma.heroBanner.createMany({
    data: [
      { title: 'Summer Sale', subtitle: 'Exclusive summer deals', headline: 'Save Big This Summer', subtext: 'Limited time offers from top merchants', discountBadge: '20% OFF', imageUrl: 'https://images.unsplash.com/hero-summer', linkUrl: '/offers/summer', linkText: 'Shop Now', isActive: true, displayOrder: 1, startDate: new Date('2026-06-01'), endDate: new Date('2026-08-31'), merchantId: activeMerchantIds[0] ?? null },
      { title: 'New Merchants', subtitle: 'Fresh additions to the platform', headline: 'Welcome Our New Partners', subtext: 'Discover exciting new offers', imageUrl: 'https://images.unsplash.com/hero-new', linkUrl: '/merchants/new', linkText: 'Explore', isActive: true, displayOrder: 2, startDate: new Date('2026-05-01'), merchantId: activeMerchantIds[1] ?? null },
      { title: 'Flash Deals', discountBadge: 'LIMITED', imageUrl: 'https://images.unsplash.com/hero-flash', isActive: false, displayOrder: 3 },
    ],
  });

  // ── Notification Events ─────────────────────────────
  await prisma.notificationEvent.createMany({
    data: [
      { recipientType: 'admin', adminId: superAdmin.id, title: 'New merchant pending approval', body: 'FitZone Gym has submitted their application.', channel: 'IN_APP', priority: 'HIGH' },
      { recipientType: 'admin', adminId: supportAdmin.id, title: 'Issue report assigned', body: 'An issue report has been assigned to you.', channel: 'IN_APP', priority: 'NORMAL' },
      { recipientType: 'admin', adminId: superAdmin.id, title: 'Bulk CSV import completed', body: 'TechCorp imported 245 employees successfully.', channel: 'IN_APP', priority: 'LOW' },
    ],
  });

  // ── Platform Settings ───────────────────────────────
  await prisma.platformSettings.createMany({
    data: [
      { key: 'general_platform_name', value: '"Employee Perks Platform"' },
      { key: 'general_support_email', value: '"support@perks.com"' },
      { key: 'general_max_redemptions_per_month', value: '10' },
      { key: 'general_currency', value: '"USD"' },
      { key: 'redemption_require_verification', value: 'true' },
      { key: 'notifications_admin_email', value: '"admin-alerts@perks.com"' },
      { key: 'csv_max_file_size_mb', value: '10' },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📋 Test Accounts (password: Test@123456):');
  console.log('   Admin:        admin@perks.com');
  console.log('   Company Admin: john@techcorp.com');
  console.log('   Employee:      techcorp.emp1@techcorp-inc.com');
  console.log(`   Merchants:     ${createdMerchants.map((m) => m.email).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
