import {
  CompanyStatus,
  PrismaClient,
  Role,
  UserActivationStatus
} from '@prisma/client';
import { hashPassword } from '../src/lib/auth';
import { sha256 } from '../src/utils/hash';

const prisma = new PrismaClient();
const seedAdminEmail = 'admin@talentum.local';
const seedAdminPassword = 'Admin12345!';
const seedManagerEmail = 'manager@acme.local';
const seedCompanyContactEmail = 'contacto@acme.local';
const seedRawInvitationToken = 'seed-invite-token-acme-manager';

async function main() {
  const adminPasswordHash = await hashPassword(seedAdminPassword);
  const admin = await prisma.user.upsert({
    where: { email: seedAdminEmail },
    update: {
      name: 'Platform Admin',
      role: Role.ADMIN,
      companyId: null,
      activationStatus: UserActivationStatus.ACTIVO,
      isActive: true,
      emailVerified: true,
      passwordHash: adminPasswordHash
    },
    create: {
      name: 'Platform Admin',
      email: seedAdminEmail,
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      companyId: null,
      activationStatus: UserActivationStatus.ACTIVO,
      isActive: true,
      emailVerified: true
    }
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: 'credential',
        accountId: admin.id
      }
    },
    update: {
      userId: admin.id,
      password: adminPasswordHash
    },
    create: {
      userId: admin.id,
      providerId: 'credential',
      accountId: admin.id,
      password: adminPasswordHash
    }
  });

  const company = await prisma.company.upsert({
    where: { slug: 'acme' },
    update: {
      name: 'Acme Corp',
      contactEmail: seedCompanyContactEmail,
      status: CompanyStatus.PENDING_SETUP,
      createdByAdminId: admin.id
    },
    create: {
      name: 'Acme Corp',
      slug: 'acme',
      logoUrl: null,
      workerCount: 25,
      contactEmail: seedCompanyContactEmail,
      status: CompanyStatus.PENDING_SETUP,
      createdByAdminId: admin.id
    }
  });

  const pendingCompanyAdmin = await prisma.user.upsert({
    where: { email: seedManagerEmail },
    update: {
      name: 'María',
      lastName: 'Gestora',
      phone: '70000000',
      role: Role.CLIENT_ADMIN,
      companyId: company.id,
      activationStatus: UserActivationStatus.PENDIENTE_ACTIVACION,
      isActive: false,
      emailVerified: false,
      passwordHash: null
    },
    create: {
      name: 'María',
      lastName: 'Gestora',
      email: seedManagerEmail,
      phone: '70000000',
      role: Role.CLIENT_ADMIN,
      companyId: company.id,
      activationStatus: UserActivationStatus.PENDIENTE_ACTIVACION,
      isActive: false,
      emailVerified: false,
      passwordHash: null
    }
  });

  const seedInvitationTokenHash = sha256(seedRawInvitationToken);
  const invitation = await prisma.invitation.upsert({
    where: { token: seedInvitationTokenHash },
    update: {
      email: seedManagerEmail,
      companyId: company.id,
      role: Role.CLIENT_ADMIN,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      revokedAt: null,
      acceptedAt: null,
      createdByAdminId: admin.id
    },
    create: {
      email: seedManagerEmail,
      token: seedInvitationTokenHash,
      companyId: company.id,
      role: Role.CLIENT_ADMIN,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      acceptedAt: null,
      revokedAt: null,
      createdByAdminId: admin.id
    }
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed_audit_company_and_invitation' },
    update: {
      actorUserId: admin.id,
      companyId: company.id,
      targetId: invitation.id
    },
    create: {
      id: 'seed_audit_company_and_invitation',
      actorUserId: admin.id,
      action: 'SEED_COMPANY_AND_INVITATION',
      companyId: company.id,
      targetType: 'INVITATION',
      targetId: invitation.id,
      metadata: {
        source: 'prisma-seed'
      }
    }
  });

  console.log('Seed completed');
  console.log({
    adminEmail: admin.email,
    adminPassword: seedAdminPassword,
    companySlug: company.slug,
    companyContactEmail: company.contactEmail,
    pendingUserId: pendingCompanyAdmin.id,
    pendingUserEmail: invitation.email,
    invitationToken: seedRawInvitationToken
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
