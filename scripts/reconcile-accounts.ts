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
  const accounts = await prisma.account.findMany({ select: { authUserId: true, profileType: true, email: true } });

  for (const acct of accounts) {
    let profileExists = false;
    switch (acct.profileType) {
      case 'ADMIN':
        profileExists = !!(await prisma.adminUser.findFirst({ where: { accountId: acct.authUserId }, select: { id: true } }));
        break;
      case 'MERCHANT':
        profileExists = !!(await prisma.merchant.findFirst({ where: { accountId: acct.authUserId }, select: { id: true } }));
        break;
      case 'COMPANY':
        profileExists = !!(await prisma.companyAdmin.findFirst({ where: { accountId: acct.authUserId }, select: { id: true } }));
        break;
      case 'EMPLOYEE':
        profileExists = !!(await prisma.employee.findFirst({ where: { accountId: acct.authUserId }, select: { id: true } }));
        break;
    }
    if (!profileExists) {
      orphanedAccounts.push(`${acct.email} (${acct.profileType}:${acct.authUserId})`);
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

  const admins = await prisma.adminUser.findMany({ select: { id: true, accountId: true } });
  for (const a of admins) {
    const has = a.accountId ? await prisma.account.findUnique({ where: { authUserId: a.accountId } }) : null;
    if (!has) missingAccounts.push(`ADMIN: ${a.id}`);
  }

  const merchants = await prisma.merchant.findMany({ select: { id: true, accountId: true } });
  for (const m of merchants) {
    const has = m.accountId ? await prisma.account.findUnique({ where: { authUserId: m.accountId } }) : null;
    if (!has) missingAccounts.push(`MERCHANT: ${m.id}`);
  }

  const companyAdmins = await prisma.companyAdmin.findMany({ select: { id: true, accountId: true } });
  for (const ca of companyAdmins) {
    const has = ca.accountId ? await prisma.account.findUnique({ where: { authUserId: ca.accountId } }) : null;
    if (!has) missingAccounts.push(`COMPANY: ${ca.id}`);
  }

  const employees = await prisma.employee.findMany({ select: { id: true, accountId: true } });
  for (const e of employees) {
    const has = e.accountId ? await prisma.account.findUnique({ where: { authUserId: e.accountId } }) : null;
    if (!has) missingAccounts.push(`EMPLOYEE: ${e.id}`);
  }

  if (missingAccounts.length > 0) {
    console.log(`⚠️  Role records missing accounts: ${missingAccounts.length}`);
    missingAccounts.forEach((a) => console.log(`   - ${a}`));
  } else {
    console.log('✅ All role records have corresponding accounts.');
  }

  console.log();

  // 4. Find duplicate emails across accounts
  const duplicateEmails = await prisma.$queryRaw<{ email: string; count: bigint }[]>`
    SELECT email, COUNT(*) as count FROM accounts
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
