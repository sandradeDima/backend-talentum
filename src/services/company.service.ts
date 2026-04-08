import { CompanyStatus, Prisma, Role } from '@prisma/client';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import type {
  CreateCompanyDto,
  ListCompaniesQueryDto,
  SuggestCompanySlugDto,
  UpdateCompanyDto
} from '../dto/company.dto';
import type { SessionPrincipal } from '../types/auth';
import { normalizeSlug } from '../utils/slug';

const MIN_SLUG_LENGTH = 2;
const SUGGESTION_LIMIT = 3;

export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {}

  private assertCompanyScope(principal: SessionPrincipal, companyId: string) {
    if (principal.role === Role.CLIENT_ADMIN && principal.companyId !== companyId) {
      throw new AppError('Acceso denegado a esta empresa', 403, 'COMPANY_SCOPE_FORBIDDEN');
    }
  }

  private assertAdminForCompanyWrite(principal: SessionPrincipal) {
    if (principal.role !== Role.ADMIN) {
      throw new AppError(
        'Solo ADMIN puede modificar empresas',
        403,
        'COMPANY_ADMIN_REQUIRED'
      );
    }
  }

  private async resolveCompanyBySlug(slug: string, principal: SessionPrincipal) {
    const normalizedSlug = normalizeSlug(slug);

    if (!normalizedSlug || normalizedSlug.length < MIN_SLUG_LENGTH) {
      throw new AppError('Slug inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const company = await this.companyRepository.findBySlugForAdmin(normalizedSlug);

    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    this.assertCompanyScope(principal, company.id);
    return company;
  }

  private async resolveUpdatedSlug(params: {
    input: UpdateCompanyDto;
    principal: SessionPrincipal;
    company: NonNullable<Awaited<ReturnType<CompanyRepository['findById']>>>;
  }) {
    if (typeof params.input.slug !== 'string') {
      return undefined;
    }

    if (params.principal.role !== Role.ADMIN) {
      throw new AppError(
        'Solo ADMIN puede modificar el slug de una empresa',
        403,
        'SLUG_EDIT_FORBIDDEN'
      );
    }

    const normalizedSlug = normalizeSlug(params.input.slug);

    if (!normalizedSlug || normalizedSlug.length < MIN_SLUG_LENGTH) {
      throw new AppError('Slug inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    if (
      params.company.status === CompanyStatus.ACTIVE &&
      normalizedSlug !== params.company.slug
    ) {
      throw new AppError(
        'No se puede modificar el slug de una empresa activa',
        409,
        'ACTIVE_COMPANY_SLUG_LOCKED'
      );
    }

    const existingSlug = await this.companyRepository.findBySlug(normalizedSlug);
    if (existingSlug && existingSlug.id !== params.company.id) {
      throw new AppError('El slug ya existe', 409, 'COMPANY_SLUG_ALREADY_EXISTS');
    }

    return normalizedSlug;
  }

  private async buildSlugSuggestions(input: {
    baseSlug: string;
    excludeCompanyId?: string;
  }) {
    const suggestions: string[] = [];
    const seen = new Set<string>();

    const tryAddSuggestion = async (rawCandidate: string) => {
      const candidate = normalizeSlug(rawCandidate);
      if (!candidate || candidate.length < MIN_SLUG_LENGTH || seen.has(candidate)) {
        return;
      }

      seen.add(candidate);

      const existing = await this.companyRepository.findBySlug(candidate);
      if (!existing || existing.id === input.excludeCompanyId) {
        suggestions.push(candidate);
      }
    };

    const fixedCandidates = [
      `${input.baseSlug}-2`,
      `${input.baseSlug}-3`,
      `${input.baseSlug}-sc`,
      `${input.baseSlug}-bo`,
      `${input.baseSlug}-empresa`,
      `${input.baseSlug}-${new Date().getFullYear()}`
    ];

    for (const candidate of fixedCandidates) {
      await tryAddSuggestion(candidate);
      if (suggestions.length >= SUGGESTION_LIMIT) {
        return suggestions.slice(0, SUGGESTION_LIMIT);
      }
    }

    let incrementalCounter = 4;
    while (suggestions.length < SUGGESTION_LIMIT && incrementalCounter <= 200) {
      await tryAddSuggestion(`${input.baseSlug}-${incrementalCounter}`);
      incrementalCounter += 1;
    }

    let randomAttempts = 0;
    while (suggestions.length < SUGGESTION_LIMIT && randomAttempts < 200) {
      randomAttempts += 1;
      const randomSuffix = Math.random().toString(36).slice(2, 6);
      await tryAddSuggestion(`${input.baseSlug}-${randomSuffix}`);
    }

    return suggestions.slice(0, SUGGESTION_LIMIT);
  }

  async suggestSlugs(input: SuggestCompanySlugDto, principal: SessionPrincipal) {
    this.assertAdminForCompanyWrite(principal);

    const normalizedSlug = normalizeSlug(input.slug);

    if (!normalizedSlug || normalizedSlug.length < MIN_SLUG_LENGTH) {
      throw new AppError('Slug inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    let excludeCompanyId: string | undefined;

    if (input.excludeSlug) {
      const normalizedExcludeSlug = normalizeSlug(input.excludeSlug);
      if (normalizedExcludeSlug) {
        const company = await this.companyRepository.findBySlugForAdmin(normalizedExcludeSlug);
        if (company) {
          excludeCompanyId = company.id;
        }
      }
    }

    const suggestions = await this.buildSlugSuggestions({
      baseSlug: normalizedSlug,
      excludeCompanyId
    });

    return {
      slug: normalizedSlug,
      suggestions
    };
  }

  async createCompany(input: CreateCompanyDto, actorUserId: string) {
    const normalizedSlug = normalizeSlug(input.slug);

    if (!normalizedSlug || normalizedSlug.length < MIN_SLUG_LENGTH) {
      throw new AppError('Slug inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const existingSlug = await this.companyRepository.findBySlug(normalizedSlug);
    if (existingSlug) {
      throw new AppError('El slug ya existe', 409, 'COMPANY_SLUG_ALREADY_EXISTS');
    }

    let company;

    try {
      company = await prisma.$transaction(async (tx) => {
        const created = await this.companyRepository.create(
          {
            name: input.name.trim(),
            slug: normalizedSlug,
            logoUrl: input.logoUrl ?? null,
            supportWhatsappPhone: input.supportWhatsappPhone?.trim() || null,
            workerCount: input.workerCount,
            contactEmail: input.contactEmail.toLowerCase(),
            status: CompanyStatus.PENDING_SETUP,
            createdByAdminId: actorUserId
          },
          tx
        );

        await this.auditLogRepository.create(
          {
            actorUserId,
            action: 'COMPANY_CREATED',
            companyId: created.id,
            targetType: 'COMPANY',
            targetId: created.id,
            metadata: {
              slug: created.slug,
              contactEmail: created.contactEmail
            }
          },
          tx
        );

        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('slug')
      ) {
        throw new AppError('El slug ya existe', 409, 'COMPANY_SLUG_ALREADY_EXISTS');
      }

      throw error;
    }

    return {
      company
    };
  }

  async listCompanies(principal: SessionPrincipal, query: ListCompaniesQueryDto) {
    const companyIdScope = principal.role === Role.ADMIN ? undefined : principal.companyId ?? undefined;

    const result = await this.companyRepository.listWithFilters({
      companyId: companyIdScope,
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status
    });

    return {
      rows: result.rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize))
      }
    };
  }

  async getCompanyById(companyId: string, principal: SessionPrincipal) {
    const company = await this.companyRepository.findById(companyId);

    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    this.assertCompanyScope(principal, company.id);
    return company;
  }

  async getCompanyBySlug(slug: string, principal: SessionPrincipal) {
    return this.resolveCompanyBySlug(slug, principal);
  }

  private async updateCompanyInternal(
    company: NonNullable<Awaited<ReturnType<CompanyRepository['findById']>>>,
    input: UpdateCompanyDto,
    principal: SessionPrincipal
  ) {
    this.assertAdminForCompanyWrite(principal);

    const normalizedSlug = await this.resolveUpdatedSlug({
      input,
      principal,
      company
    });

    try {
      const updated = await this.companyRepository.updateById(company.id, {
        name: input.name?.trim(),
        slug: normalizedSlug,
        logoUrl: input.logoUrl,
        supportWhatsappPhone:
          typeof input.supportWhatsappPhone === 'string'
            ? input.supportWhatsappPhone.trim()
            : input.supportWhatsappPhone,
        workerCount: input.workerCount,
        contactEmail: input.contactEmail?.toLowerCase(),
        status: input.status
      });

      await this.auditLogRepository.create({
        actorUserId: principal.id,
        action: 'COMPANY_UPDATED',
        companyId: updated.id,
        targetType: 'COMPANY',
        targetId: updated.id,
        metadata: {
          payload: input
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('slug')
      ) {
        throw new AppError('El slug ya existe', 409, 'COMPANY_SLUG_ALREADY_EXISTS');
      }

      throw new AppError('No se pudo actualizar la empresa', 400, String(error));
    }
  }

  async updateCompany(
    companyId: string,
    input: UpdateCompanyDto,
    principal: SessionPrincipal
  ) {
    const company = await this.getCompanyById(companyId, principal);
    return this.updateCompanyInternal(company, input, principal);
  }

  async updateCompanyBySlug(
    slug: string,
    input: UpdateCompanyDto,
    principal: SessionPrincipal
  ) {
    const company = await this.resolveCompanyBySlug(slug, principal);
    return this.updateCompanyInternal(company, input, principal);
  }
}
