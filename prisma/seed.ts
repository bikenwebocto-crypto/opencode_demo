import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedLimassolMerchants } from './seed-limassol-merchants';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
  
async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data in dependency order (children before parents)
  await prisma.$transaction([
    // Complaints (children first)
    prisma.complaintAction.deleteMany(),
    prisma.complaintEscalation.deleteMany(),
    prisma.complaint.deleteMany(),

    // Banners
    prisma.bannerContent.deleteMany(),
    prisma.bannerBooking.deleteMany(),
    prisma.banner.deleteMany(),

    // Reviews & offer-adjacent
    prisma.merchantReview.deleteMany(),
    prisma.offerView.deleteMany(),
    prisma.dailyOfferAnalytics.deleteMany(),

    // Notifications
    prisma.notificationDelivery.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.deviceToken.deleteMany(),

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
    prisma.merchantOffer.deleteMany(), // cascades content/pricing/redemption/review/analytics
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

    // Standalone (no FK dependents elsewhere)
    prisma.loginBranding.deleteMany(),
    prisma.theme.deleteMany(),
  ]);

  const pw = await hashPassword('Test@123456');

  // ── Admins ────────────────────────────────────────────
  const superAdminAccount = await prisma.account.create({
    data: { email: 'admin@perks.com', role: 'SUPER_ADMIN', profileType: 'ADMIN', status: 'ACTIVE' },
  });
  const superAdmin = await prisma.adminUser.create({
    data: {
      accountId: superAdminAccount.authUserId,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
 

  const supportAdminAccount = await prisma.account.create({
    data: { email: 'support@perks.com',  role: 'SUPER_ADMIN', profileType: 'ADMIN', status: 'ACTIVE' },
  });
  const supportAdmin = await prisma.adminUser.create({
    data: {
      accountId: supportAdminAccount.authUserId,
      firstName: 'Support',
      lastName: 'Agent',
      role: 'SUPPORT_ADMIN',
      isActive: true,
    },
  });


  const financeAdminAccount = await prisma.account.create({
    data: { email: 'finance@perks.com',  role: 'SUPER_ADMIN', profileType: 'ADMIN', status: 'ACTIVE' },
  });
  const financeAdmin = await prisma.adminUser.create({
    data: {
      accountId: financeAdminAccount.authUserId,
      firstName: 'Finance',
      lastName: 'Admin',
      role: 'FINANCE_ADMIN',
      isActive: true,
    },
  });

  // ── Login Branding ────────────────────────────────────
  await prisma.loginBranding.create({
    data: {
      appName: 'Employee Perks Platform',
      tagline: 'Exclusive perks for your team',
      heading: 'Welcome back',
      description: 'Sign in to access your employee perks and offers.',
      logoUrl: null,
      bannerUrl: null,
      backgroundImageUrl: null,
      primaryColor: '#4F46E5',
      secondaryColor: '#818CF8',
      accentColor: '#F59E0B',
      textColor: '#111827',
      cardBackground: '#FFFFFF',
      layout: 'SPLIT_CARD',
      showLogo: true,
      showHeading: true,
      showDescription: true,
      showBanner: true,
      showFooter: true,
      footerTitle: 'Employee Perks Platform',
      footerDescription: 'Save more, every day.',
      copyright: `© ${new Date().getFullYear()} Employee Perks Platform. All rights reserved.`,
    },
  });
  console.log('Created default LoginBranding');

  // ── Theme ──────────────────────────────────────────────
  await prisma.theme.create({
    data: {
      name: 'Default',
      slug: 'default',
      isActive: true,
      settings: {},
    },
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
    const acct = await prisma.account.create({
      data: { email: ca.email,  role: 'COMPANY_ADMIN', profileType: 'COMPANY', status: 'ACTIVE' },
    });
    const admin = await prisma.companyAdmin.create({
      data: { companyId: ca.companyId, firstName: ca.firstName, lastName: ca.lastName, isPrimary: true, isActive: true, accountId: acct.authUserId },
    });
  
  }

  // ── Categories (global master data) ──────────────────
  const catNames = ['Food & Dining', 'Retail', 'Technology', 'Health & Fitness', 'Entertainment', 'Travel', 'Fashion', 'Shopping Malls', 'Family & Kids', 'Home Improvement', 'Toys & Games'];
  const catData: { name: string; slug: string; description?: string; icon?: string; displayOrder: number }[] = [];
  catNames.forEach((name, i) => {
    catData.push({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon: ['utensils', 'shopping-bag', 'laptop', 'heart', 'film', 'plane', 'shirt', 'building', 'users', 'wrench', 'gamepad'][i],
      displayOrder: i,
    });
  });
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
      const email = `${prefix}.emp${i + 1}@${company.slug}.com`;
      const acct = await prisma.account.create({
        data: {
          email,
          role: 'EMPLOYEE',
          profileType: 'EMPLOYEE',
          status: statuses[i] === 'INVITED' ? 'PENDING' : 'ACTIVE',
        },
      });
      const emp = await prisma.employee.create({
        data: {
          companyId: company.id,
          accountId: acct.authUserId,
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
  const merchantEmails = new Map<string, string>();

  for (const m of merchantInputs) {
    const cat = allCategories.find((c) => c.name === m.category);
    const acct = await prisma.account.create({
      data: {
        email: m.email,
        role: 'MERCHANT',
        profileType: 'MERCHANT',
        status: m.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
      },
    });
    const merchant = await prisma.merchant.create({
      data: {
        accountId: acct.authUserId,
        businessName: m.businessName,
        slug: m.slug,
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
 
    createdMerchants.push(merchant);
    merchantEmails.set(merchant.id, m.email);
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
        email: merchantEmails.get(merchant.id) ?? '',
        isActive: true,
      },
    });
  }

  // ── Limassol Merchants (Cyprus) ───────────────────────
  await seedLimassolMerchants(prisma);

  const activeMerchants = createdMerchants.filter((m) => m.status === 'ACTIVE');
  const techCorpEmployees = allEmployees.filter((e) => e.companyId === techCorp.id);
  const firstMerchant = activeMerchants[0]!;

  // NOTE: Merchant offers and redemptions are intentionally NOT seeded at this time.
  // Add offer creation and redemptions manually as needed.

  // ── Action Queue Items ──────────────────────────────
  const pendingMerchants = createdMerchants.filter((m) => m.status === 'PENDING');
  for (const pm of pendingMerchants) {
    const email = merchantEmails.get(pm.id) ?? '';
    await prisma.actionQueueItem.create({
      data: {
        type: 'NEW_MERCHANT_APPLICATION',
        title: `Approve merchant: ${pm.businessName}`,
        description: `New merchant registration from ${email} — review and approve their application.`,
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
        type: 'OFFER_REPLACEMENT',
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
    const refCompany = [techCorp, globalSolutions, innovateX, northStar][i % 4]!;
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
      { key: 'general_currency', value: '"GBP"' },
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
  console.log(`   Merchants:     ${merchantInputs.map((m) => m.email).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
