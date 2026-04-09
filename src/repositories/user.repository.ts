import {
  Role,
  UserActivationStatus,
  type Prisma,
  type User
} from '@prisma/client';
import { prisma } from '../lib/prisma';

const defaultUserSelect = {
  id: true,
  name: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  activationStatus: true,
  companyId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

const companyAdminUserSelect = {
  ...defaultUserSelect,
  emailVerified: true,
  passwordHash: true,
  accounts: {
    select: {
      providerId: true,
      password: true
    }
  }
} satisfies Prisma.UserSelect;

const globalCompanyAdminUserSelect = {
  ...companyAdminUserSelect,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true
    }
  }
} satisfies Prisma.UserSelect;

export type CompanyAdminUserRow = Prisma.UserGetPayload<{
  select: typeof companyAdminUserSelect;
}>;

export type GlobalCompanyAdminUserRow = Prisma.UserGetPayload<{
  select: typeof globalCompanyAdminUserSelect;
}>;

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        company: true
      }
    });
  }

  async findById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true
      }
    });
  }

  async listCompanyAdmins(companyId: string) {
    return prisma.user.findMany({
      where: {
        companyId,
        role: Role.CLIENT_ADMIN
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: companyAdminUserSelect
    });
  }

  async listCompanyAdminsGlobal(input: {
    page: number;
    pageSize: number;
    search?: string;
    company?: string;
    activationStatus?: UserActivationStatus;
  }) {
    const where: Prisma.UserWhereInput = {
      role: {
        in: [Role.ADMIN, Role.CLIENT_ADMIN]
      },
      ...(input.activationStatus ? { activationStatus: input.activationStatus } : {}),
      ...(input.company
        ? {
            company: {
              is: {
                OR: [
                  { slug: { contains: input.company } },
                  { name: { contains: input.company } }
                ]
              }
            }
          }
        : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search } },
              { lastName: { contains: input.search } },
              { email: { contains: input.search } },
              { company: { is: { name: { contains: input.search } } } },
              { company: { is: { slug: { contains: input.search } } } }
            ]
          }
        : {})
    };

    const skip = (input.page - 1) * input.pageSize;

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: input.pageSize,
        orderBy: {
          createdAt: 'desc'
        },
        select: globalCompanyAdminUserSelect
      }),
      prisma.user.count({ where })
    ]);

    return {
      rows,
      total
    };
  }

  async findCompanyAdminById(companyId: string, userId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: Role.CLIENT_ADMIN
      },
      select: companyAdminUserSelect
    });
  }

  async findGlobalAdminById(
    userId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.user.findFirst({
      where: {
        id: userId,
        role: Role.ADMIN
      },
      select: globalCompanyAdminUserSelect
    });
  }

  async createPendingCompanyAdmin(
    input: {
      name: string;
      lastName: string;
      email: string;
      phone: string;
      role: Role;
      companyId: string;
    },
    tx: Prisma.TransactionClient
  ) {
    return tx.user.create({
      data: {
        name: input.name,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        role: input.role,
        activationStatus: UserActivationStatus.PENDIENTE_ACTIVACION,
        companyId: input.companyId,
        emailVerified: false,
        isActive: false,
        passwordHash: null
      },
      select: companyAdminUserSelect
    });
  }

  async createClientAdminWithCredential(
    input: {
      name: string;
      lastName?: string | null;
      phone?: string | null;
      email: string;
      passwordHash: string;
      companyId: string;
    },
    tx: Prisma.TransactionClient
  ) {
    const user = await tx.user.create({
      data: {
        name: input.name,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        email: input.email.toLowerCase(),
        emailVerified: true,
        passwordHash: input.passwordHash,
        role: Role.CLIENT_ADMIN,
        activationStatus: UserActivationStatus.ACTIVO,
        companyId: input.companyId,
        isActive: true,
        lastLoginAt: new Date()
      },
      select: defaultUserSelect
    });

    await this.upsertCredentialAccount(user.id, input.passwordHash, tx);

    return user;
  }

  async createGlobalAdminWithCredential(
    input: {
      name: string;
      lastName?: string | null;
      phone?: string | null;
      email: string;
      passwordHash: string;
    },
    tx: Prisma.TransactionClient
  ) {
    const user = await tx.user.create({
      data: {
        name: input.name,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        email: input.email.toLowerCase(),
        emailVerified: true,
        passwordHash: input.passwordHash,
        role: Role.ADMIN,
        activationStatus: UserActivationStatus.ACTIVO,
        companyId: null,
        isActive: true
      },
      select: defaultUserSelect
    });

    await this.upsertCredentialAccount(user.id, input.passwordHash, tx);

    return tx.user.findUniqueOrThrow({
      where: {
        id: user.id
      },
      select: globalCompanyAdminUserSelect
    });
  }

  async updateById(
    userId: string,
    data: Prisma.UserUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    return db.user.update({
      where: { id: userId },
      data,
      select: companyAdminUserSelect
    });
  }

  async touchLastLogin(
    userId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    return db.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date()
      },
      select: defaultUserSelect
    });
  }

  async upsertCredentialAccount(
    userId: string,
    passwordHash: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.account.upsert({
      where: {
        providerId_accountId: {
          providerId: 'credential',
          accountId: userId
        }
      },
      update: {
        userId,
        password: passwordHash
      },
      create: {
        userId,
        providerId: 'credential',
        accountId: userId,
        password: passwordHash
      }
    });
  }

  async updateRoleAndCompany(input: {
    userId: string;
    role: Role;
    companyId: string | null;
  }): Promise<User> {
    return prisma.user.update({
      where: { id: input.userId },
      data: {
        role: input.role,
        companyId: input.companyId
      }
    });
  }
}
