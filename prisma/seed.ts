import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

const ROLES: Array<{ name: string; permissions: Record<string, string[]> }> =
  [
    {
      name: 'super_admin',
      // Full, unrestricted access across every resource.
      permissions: { '*': ['*'] },
    },
    {
      name: 'admin',
      // Manages products, categories, inventory, and orders — staff/user
      // management and the audit log stay super_admin-only per the TRD.
      permissions: {
        categories: ['create', 'read', 'update', 'delete'],
        products: ['create', 'read', 'update', 'delete'],
        inventory: ['read', 'update'],
        // "create" covers admin-placed orders (TRD §9: "customer/admin
        // places an order"), not just viewing/updating existing ones.
        orders: ['create', 'read', 'update'],
        payments: ['read'],
        'custom-designs': ['read'],
      },
    },
    {
      name: 'inventory_manager',
      permissions: {
        products: ['read'],
        inventory: ['create', 'read', 'update'],
      },
    },
    {
      name: 'support',
      // View-only: orders/customers, no product/inventory edit rights.
      permissions: {
        users: ['read'],
        orders: ['read'],
        payments: ['read'],
        'custom-designs': ['read'],
      },
    },
  ];

async function main() {
  console.log('Seeding roles...');

  const roleRecords = new Map<string, string>();

  for (const role of ROLES) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: { name: role.name, permissions: role.permissions },
    });
    roleRecords.set(role.name, record.id);
    console.log(`  - ${role.name} (${record.id})`);
  }

  const superAdminRoleId = roleRecords.get('super_admin');
  if (!superAdminRoleId) {
    throw new Error('super_admin role was not created/found during seed');
  }

  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@rastus.dev';
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(superAdminPassword, 10);

  console.log('Seeding super_admin user...');

  const superAdminUser = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      roleId: superAdminRoleId,
      isStaff: true,
      status: 'ACTIVE',
    },
    create: {
      email: superAdminEmail,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      roleId: superAdminRoleId,
      isStaff: true,
      status: 'ACTIVE',
    },
  });

  console.log(`  - ${superAdminUser.email} (${superAdminUser.id})`);

  if (!process.env.SEED_SUPER_ADMIN_PASSWORD) {
    console.warn(
      '\n[seed] SEED_SUPER_ADMIN_PASSWORD was not set — using the default ' +
        `password "${superAdminPassword}". Change this immediately in ` +
        'non-local environments.',
    );
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
