import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcileAccounts() {
  console.log('=== Account Reconciliation Report ===\n');

  // 1. Count all role records
  const [adminCount, merchantCount, companyAdminCount, employeeCount, accountCount] = await Promise.all([
    prisma.adminUser.count(),
    prisma.merchant.count(),
    prisma.companyAdmin.count(),
    prisma.employee.count(),
    prisma.account.count(),
  ]);

  const totalRoleRecords = adminCount + merchantCount + companyAdminCount + employeeCount;

  console.log(`AdminUsers:        ${adminCount}`);
  console.log(`Merchants:         ${merchantCount}`);
  console.log(`CompanyAdmins:     ${companyAdminCount}`);
  console.log(`Employees:         ${employeeCount}`);
  console.log(`Total role records: ${totalRoleRecords}`);
  console.log(`Account records:    ${accountCount}`);
  console.log(`Difference:         ${totalRoleRecords - accountCount}\n`);

  // 2. Find accounts without matching profile records
  const orphanedAccounts: string[] = [];
  const accounts = await prisma.account.findMany({ select: { authUserId: true, profileId: true, profileType: true, email: true } });

  for (const acct of accounts) {
    let profileExists = false;
    switch (acct.profileType) {
      case 'ADMIN':
        profileExists = !!(await prisma.adminUser.findUnique({ where: { id: acct.profileId }, select: { id: true } }));
        break;
      case 'MERCHANT':
        profileExists = !!(await prisma.merchant.findUnique({ where: { id: acct.profileId }, select: { id: true } }));
        break;
      case 'COMPANY':
        profileExists = !!(await prisma.companyAdmin.findUnique({ where: { id: acct.profileId }, select: { id: true } }));
        break;
      case 'EMPLOYEE':
        profileExists = !!(await prisma.employee.findUnique({ where: { id: acct.profileId }, select: { id: true } }));
        break;
    }
    if (!profileExists) {
      orphanedAccounts.push(`${acct.email} (${acct.profileType}:${acct.profileId})`);
    }
  }

  if (orphanedAccounts.length > 0) {
    console.log(`⚠️  Orphaned accounts (no matching profile): ${orphanedAccounts.length}`);
    orphanedAccounts.forEach((a) => console.log(`   - ${a}`));
  } else {
    console.log('✅ No orphaned accounts found.');
  }

  console.log();

  // 3. Find role records missing accounts
  const missingAccounts: string[] = [];

  const admins = await prisma.adminUser.findMany({ select: { id: true, email: true } });
  for (const a of admins) {
    const has = await prisma.account.findFirst({ where: { profileId: a.id, profileType: 'ADMIN' } });
    if (!has) missingAccounts.push(`ADMIN: ${a.email} (${a.id})`);
  }

  const merchants = await prisma.merchant.findMany({ select: { id: true, email: true } });
  for (const m of merchants) {
    const has = await prisma.account.findFirst({ where: { profileId: m.id, profileType: 'MERCHANT' } });
    if (!has) missingAccounts.push(`MERCHANT: ${m.email} (${m.id})`);
  }

  const companyAdmins = await prisma.companyAdmin.findMany({ select: { id: true, email: true } });
  for (const ca of companyAdmins) {
    const has = await prisma.account.findFirst({ where: { profileId: ca.id, profileType: 'COMPANY' } });
    if (!has) missingAccounts.push(`COMPANY: ${ca.email} (${ca.id})`);
  }

  const employees = await prisma.employee.findMany({ select: { id: true, email: true } });
  for (const e of employees) {
    const has = await prisma.account.findFirst({ where: { profileId: e.id, profileType: 'EMPLOYEE' } });
    if (!has) missingAccounts.push(`EMPLOYEE: ${e.email} (${e.id})`);
  }

  if (missingAccounts.length > 0) {
    console.log(`⚠️  Role records missing accounts: ${missingAccounts.length}`);
    missingAccounts.forEach((a) => console.log(`   - ${a}`));
  } else {
    console.log('✅ All role records have corresponding accounts.');
  }

  console.log();

  // 4. Find duplicate emails
  const duplicateEmails = await prisma.$queryRaw<{ email: string; count: bigint }[]>`
    SELECT email, COUNT(*) as count FROM (
      SELECT email FROM admin_users
      UNION ALL
      SELECT email FROM merchants
      UNION ALL
      SELECT email FROM company_admins
      UNION ALL
      SELECT email FROM employees
    ) AS all_emails
    GROUP BY email
    HAVING COUNT(*) > 1
  `;

  if (duplicateEmails.length > 0) {
    console.log(`⚠️  Duplicate emails across role tables: ${duplicateEmails.length}`);
    for (const d of duplicateEmails) {
      console.log(`   - ${d.email} (${d.count} occurrences)`);
    }
  } else {
    console.log('✅ No duplicate emails across role tables.');
  }

  console.log();

  // 5. Summary
  console.log('=== Summary ===');
  console.log(`Total role records: ${totalRoleRecords}`);
  console.log(`Total accounts:     ${accountCount}`);
  console.log(`Orphaned accounts:  ${orphanedAccounts.length}`);
  console.log(`Missing accounts:   ${missingAccounts.length}`);
  console.log(`Duplicate emails:   ${duplicateEmails.length}`);

  await prisma.$disconnect();
}

reconcileAccounts().catch((e) => {
  console.error('Reconciliation failed:', e);
  process.exit(1);
});
