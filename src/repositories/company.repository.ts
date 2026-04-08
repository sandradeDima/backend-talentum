import { type Company, type CompanyStatus, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const companyTableSelect = {
  id: true,
  name: true,
  slug: true,
  workerCount: true,
  contactEmail: true,
  supportWhatsappPhone: true,
  status: true,
  createdAt: true,
  logoUrl: true
} satisfies Prisma.CompanySelect;

export type CompanyTableRow = Prisma.CompanyGetPayload<{
  select: typeof companyTableSelect;
}>;

export class CompanyRepository {
  async create(
    input: {
      name: string;
      slug: string;
      logoUrl: string | null;
      supportWhatsappPhone: string | null;
      workerCount: number;
      contactEmail: string;
      status: CompanyStatus;
      createdByAdminId: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<Company> {
    const db = tx ?? prisma;
    return db.company.create({
      data: input
    });
  }

  async findBySlug(slug: string) {
    return prisma.company.findUnique({
      where: { slug }
    });
  }

  async findPublicContextBySlug(slug: string) {
    return prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        logoUrl: true,
        supportWhatsappPhone: true
      }
    });
  }

  async findById(id: string) {
    return prisma.company.findUnique({
      where: { id },
      select: companyTableSelect
    });
  }

  async findBySlugForAdmin(slug: string) {
    return prisma.company.findUnique({
      where: { slug },
      select: companyTableSelect
    });
  }

  async listWithFilters(input: {
    companyId?: string;
    page: number;
    pageSize: number;
    search?: string;
    status?: CompanyStatus;
  }) {
    const where: Prisma.CompanyWhereInput = {
      ...(input.companyId ? { id: input.companyId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search } },
              { slug: { contains: input.search } },
              { contactEmail: { contains: input.search } }
            ]
          }
        : {})
    };

    const skip = (input.page - 1) * input.pageSize;

    const [rows, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: input.pageSize,
        orderBy: { createdAt: 'desc' },
        select: companyTableSelect
      }),
      prisma.company.count({ where })
    ]);

    return {
      rows,
      total
    };
  }

  async updateById(
    id: string,
    data: Prisma.CompanyUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    return db.company.update({
      where: { id },
      data,
      select: companyTableSelect
    });
  }
}
