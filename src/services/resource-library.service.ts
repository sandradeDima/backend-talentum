import { Prisma, ResourceLibraryItemType, Role } from '@prisma/client';
import type {
  CreateResourceLibraryItemDto,
  ListResourceLibraryQueryDto,
  UpdateResourceLibraryItemDto
} from '../dto/resource-library.dto';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import type { SessionPrincipal } from '../types/auth';
import type { AuditRequestContext } from '../utils/request-context';
import { normalizeSlug } from '../utils/slug';

const resourceListSelect = {
  id: true,
  title: true,
  description: true,
  url: true,
  itemType: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  },
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  updatedByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.ResourceLibraryItemSelect;

export class ResourceLibraryService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {}

  private assertClientAdminCompany(principal: SessionPrincipal): string {
    if (!principal.companyId) {
      throw new AppError(
        'El usuario no tiene una empresa asignada',
        403,
        'CLIENT_ADMIN_NO_COMPANY'
      );
    }

    return principal.companyId;
  }

  private async resolveCompanyIdBySlug(
    companySlugRaw: string
  ): Promise<{ id: string; slug: string; name: string }> {
    const companySlug = normalizeSlug(companySlugRaw);

    if (!companySlug) {
      throw new AppError('Slug de empresa inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const company = await this.companyRepository.findBySlugForAdmin(companySlug);
    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    return {
      id: company.id,
      slug: company.slug,
      name: company.name
    };
  }

  private async resolveTargetCompanyIdForWrite(
    inputCompanySlug: string | undefined,
    principal: SessionPrincipal
  ): Promise<string | null> {
    if (principal.role === Role.CLIENT_ADMIN) {
      return this.assertClientAdminCompany(principal);
    }

    if (!inputCompanySlug) {
      return null;
    }

    const company = await this.resolveCompanyIdBySlug(inputCompanySlug);
    return company.id;
  }

  private assertCanMutateItem(
    item: { companyId: string | null },
    principal: SessionPrincipal
  ) {
    if (principal.role === Role.ADMIN) {
      return;
    }

    const companyId = this.assertClientAdminCompany(principal);
    if (!item.companyId || item.companyId !== companyId) {
      throw new AppError(
        'No tienes permisos para modificar este recurso',
        403,
        'RESOURCE_LIBRARY_FORBIDDEN'
      );
    }
  }

  private toResourceUpdateData(
    input: UpdateResourceLibraryItemDto,
    resolvedCompanyId: string | null | undefined,
    principal: SessionPrincipal
  ): Prisma.ResourceLibraryItemUpdateInput {
    const data: Prisma.ResourceLibraryItemUpdateInput = {
      updatedByUser: {
        connect: {
          id: principal.id
        }
      }
    };

    if (typeof input.title === 'string') {
      data.title = input.title;
    }

    if (typeof input.description === 'string') {
      data.description = input.description || null;
    }

    if (typeof input.url === 'string') {
      data.url = input.url;
    }

    if (input.itemType) {
      data.itemType = input.itemType;
    }

    if (typeof input.isActive === 'boolean') {
      data.isActive = input.isActive;
    }

    if (typeof input.metadata !== 'undefined') {
      data.metadata = (input.metadata ?? null) as Prisma.InputJsonValue;
    }

    if (typeof resolvedCompanyId !== 'undefined') {
      data.company = resolvedCompanyId
        ? {
            connect: {
              id: resolvedCompanyId
            }
          }
        : {
            disconnect: true
          };
    }

    return data;
  }

  async listResources(query: ListResourceLibraryQueryDto, principal: SessionPrincipal) {
    const whereAnd: Prisma.ResourceLibraryItemWhereInput[] = [];

    if (query.status === 'active') {
      whereAnd.push({ isActive: true });
    } else if (query.status === 'inactive') {
      whereAnd.push({ isActive: false });
    }

    if (query.itemType) {
      whereAnd.push({ itemType: query.itemType });
    }

    if (query.search) {
      whereAnd.push({
        OR: [
          { title: { contains: query.search } },
          { description: { contains: query.search } },
          { url: { contains: query.search } }
        ]
      });
    }

    if (principal.role === Role.CLIENT_ADMIN) {
      const companyId = this.assertClientAdminCompany(principal);

      if (query.companySlug) {
        const company = await this.resolveCompanyIdBySlug(query.companySlug);
        if (company.id !== companyId) {
          throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
        }
      }

      if (query.scope === 'global') {
        whereAnd.push({ companyId: null });
      } else if (query.scope === 'company') {
        whereAnd.push({ companyId });
      } else {
        whereAnd.push({
          OR: [{ companyId: null }, { companyId }]
        });
      }
    } else {
      if (query.companySlug) {
        const company = await this.resolveCompanyIdBySlug(query.companySlug);
        whereAnd.push({ companyId: company.id });
      } else if (query.scope === 'global') {
        whereAnd.push({ companyId: null });
      } else if (query.scope === 'company') {
        whereAnd.push({ companyId: { not: null } });
      }
    }

    const where: Prisma.ResourceLibraryItemWhereInput = whereAnd.length
      ? { AND: whereAnd }
      : {};

    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      prisma.resourceLibraryItem.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        select: resourceListSelect
      }),
      prisma.resourceLibraryItem.count({ where })
    ]);

    return {
      rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  }

  async getResourceById(resourceIdRaw: string, principal: SessionPrincipal) {
    const resourceId = resourceIdRaw.trim();

    const item = await prisma.resourceLibraryItem.findUnique({
      where: {
        id: resourceId
      },
      select: resourceListSelect
    });

    if (!item) {
      throw new AppError('Recurso no encontrado', 404, 'RESOURCE_LIBRARY_ITEM_NOT_FOUND');
    }

    if (principal.role === Role.CLIENT_ADMIN) {
      const companyId = this.assertClientAdminCompany(principal);
      if (item.company?.id && item.company.id !== companyId) {
        throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
      }
    }

    return item;
  }

  async createResource(
    input: CreateResourceLibraryItemDto,
    principal: SessionPrincipal,
    auditContext: AuditRequestContext
  ) {
    const companyId = await this.resolveTargetCompanyIdForWrite(input.companySlug, principal);

    const created = await prisma.resourceLibraryItem.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        url: input.url,
        itemType: input.itemType,
        companyId,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        createdByUserId: principal.id
      },
      select: resourceListSelect
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'RESOURCE_LIBRARY_ITEM_CREATED',
      companyId: companyId ?? undefined,
      targetType: 'RESOURCE_LIBRARY_ITEM',
      targetId: created.id,
      requestId: auditContext.requestId,
      ipAddress: auditContext.ipAddress ?? undefined,
      userAgent: auditContext.userAgent ?? undefined,
      metadata: {
        title: created.title,
        itemType: created.itemType,
        scope: companyId ? 'COMPANY' : 'GLOBAL'
      }
    });

    return created;
  }

  async updateResource(
    resourceIdRaw: string,
    input: UpdateResourceLibraryItemDto,
    principal: SessionPrincipal,
    auditContext: AuditRequestContext
  ) {
    const resourceId = resourceIdRaw.trim();

    const existing = await prisma.resourceLibraryItem.findUnique({
      where: {
        id: resourceId
      },
      select: {
        id: true,
        companyId: true
      }
    });

    if (!existing) {
      throw new AppError('Recurso no encontrado', 404, 'RESOURCE_LIBRARY_ITEM_NOT_FOUND');
    }

    this.assertCanMutateItem(existing, principal);

    let resolvedCompanyId: string | null | undefined;

    if (principal.role === Role.CLIENT_ADMIN && typeof input.companySlug !== 'undefined') {
      throw new AppError(
        'No puedes cambiar la empresa de un recurso',
        403,
        'RESOURCE_LIBRARY_COMPANY_CHANGE_FORBIDDEN'
      );
    }

    if (principal.role === Role.ADMIN && typeof input.companySlug !== 'undefined') {
      resolvedCompanyId =
        input.companySlug === null
          ? null
          : await this.resolveTargetCompanyIdForWrite(input.companySlug, principal);
    }

    const data = this.toResourceUpdateData(input, resolvedCompanyId, principal);

    const updated = await prisma.resourceLibraryItem.update({
      where: {
        id: resourceId
      },
      data,
      select: resourceListSelect
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'RESOURCE_LIBRARY_ITEM_UPDATED',
      companyId: updated.company?.id,
      targetType: 'RESOURCE_LIBRARY_ITEM',
      targetId: updated.id,
      requestId: auditContext.requestId,
      ipAddress: auditContext.ipAddress ?? undefined,
      userAgent: auditContext.userAgent ?? undefined,
      metadata: {
        title: updated.title,
        itemType: updated.itemType,
        isActive: updated.isActive
      }
    });

    return updated;
  }

  async deactivateResource(
    resourceIdRaw: string,
    principal: SessionPrincipal,
    auditContext: AuditRequestContext
  ) {
    const resourceId = resourceIdRaw.trim();

    const existing = await prisma.resourceLibraryItem.findUnique({
      where: {
        id: resourceId
      },
      select: {
        id: true,
        companyId: true,
        isActive: true
      }
    });

    if (!existing) {
      throw new AppError('Recurso no encontrado', 404, 'RESOURCE_LIBRARY_ITEM_NOT_FOUND');
    }

    this.assertCanMutateItem(existing, principal);

    if (!existing.isActive) {
      return this.getResourceById(resourceId, principal);
    }

    const updated = await prisma.resourceLibraryItem.update({
      where: {
        id: resourceId
      },
      data: {
        isActive: false,
        updatedByUserId: principal.id
      },
      select: resourceListSelect
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'RESOURCE_LIBRARY_ITEM_DEACTIVATED',
      companyId: updated.company?.id,
      targetType: 'RESOURCE_LIBRARY_ITEM',
      targetId: updated.id,
      requestId: auditContext.requestId,
      ipAddress: auditContext.ipAddress ?? undefined,
      userAgent: auditContext.userAgent ?? undefined,
      metadata: {
        title: updated.title,
        itemType: updated.itemType
      }
    });

    return updated;
  }

  getSupportedItemTypes() {
    return Object.values(ResourceLibraryItemType) as ResourceLibraryItemType[];
  }
}
