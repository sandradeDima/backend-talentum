import { Prisma, Role, SupportConfigScope } from '@prisma/client';
import type { SupportConfigQueryDto, UpsertSupportConfigDto } from '../dto/support-config.dto';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import type { SessionPrincipal } from '../types/auth';
import type { AuditRequestContext } from '../utils/request-context';
import { normalizeSlug } from '../utils/slug';

const supportConfigSelect = {
  id: true,
  scopeType: true,
  scopeKey: true,
  enabled: true,
  whatsappLink: true,
  supportEmail: true,
  helpCenterUrl: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      slug: true,
      name: true
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
} satisfies Prisma.SupportConfigSelect;

export class SupportConfigService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {}

  private assertClientAdminCompany(principal: SessionPrincipal): {
    companyId: string;
    companySlug: string | null;
  } {
    if (!principal.companyId) {
      throw new AppError(
        'El usuario no tiene una empresa asignada',
        403,
        'CLIENT_ADMIN_NO_COMPANY'
      );
    }

    return {
      companyId: principal.companyId,
      companySlug: principal.companySlug
    };
  }

  private buildScopeKey(input: { scopeType: SupportConfigScope; companyId?: string | null }) {
    if (input.scopeType === SupportConfigScope.GLOBAL) {
      return 'GLOBAL';
    }

    if (!input.companyId) {
      throw new AppError('Empresa requerida para alcance COMPANY', 400, 'COMPANY_REQUIRED');
    }

    return `COMPANY:${input.companyId}`;
  }

  private async resolveCompanyBySlug(companySlugRaw: string) {
    const companySlug = normalizeSlug(companySlugRaw);

    if (!companySlug) {
      throw new AppError('Slug de empresa inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const company = await this.companyRepository.findBySlugForAdmin(companySlug);

    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    return company;
  }

  private async findScopeConfig(input: {
    scopeType: SupportConfigScope;
    companyId?: string | null;
    onlyEnabled?: boolean;
  }) {
    const scopeKey = this.buildScopeKey({
      scopeType: input.scopeType,
      companyId: input.companyId
    });

    return prisma.supportConfig.findUnique({
      where: {
        scopeKey
      },
      select: supportConfigSelect
    });
  }

  private mapResolvedConfig(
    config: Prisma.SupportConfigGetPayload<{ select: typeof supportConfigSelect }> | null,
    source: 'GLOBAL' | 'COMPANY' | null,
    fallbackUsed: boolean
  ) {
    if (!config) {
      return {
        config: null,
        source,
        fallbackUsed
      };
    }

    return {
      config,
      source,
      fallbackUsed
    };
  }

  async getSupportConfig(query: SupportConfigQueryDto, principal: SessionPrincipal) {
    if (principal.role === Role.CLIENT_ADMIN) {
      const { companyId } = this.assertClientAdminCompany(principal);

      const companyConfig = await this.findScopeConfig({
        scopeType: SupportConfigScope.COMPANY,
        companyId
      });

      if (companyConfig && companyConfig.enabled) {
        return this.mapResolvedConfig(companyConfig, 'COMPANY', false);
      }

      const globalConfig = await this.findScopeConfig({
        scopeType: SupportConfigScope.GLOBAL
      });

      return this.mapResolvedConfig(globalConfig, 'GLOBAL', Boolean(companyConfig));
    }

    if (query.companySlug) {
      const company = await this.resolveCompanyBySlug(query.companySlug);

      const companyConfig = await this.findScopeConfig({
        scopeType: SupportConfigScope.COMPANY,
        companyId: company.id
      });

      if (companyConfig && companyConfig.enabled) {
        return this.mapResolvedConfig(companyConfig, 'COMPANY', false);
      }

      const globalConfig = await this.findScopeConfig({
        scopeType: SupportConfigScope.GLOBAL
      });

      return this.mapResolvedConfig(globalConfig, 'GLOBAL', Boolean(companyConfig));
    }

    const globalConfig = await this.findScopeConfig({
      scopeType: SupportConfigScope.GLOBAL
    });

    return this.mapResolvedConfig(globalConfig, 'GLOBAL', false);
  }

  async upsertSupportConfig(
    input: UpsertSupportConfigDto,
    principal: SessionPrincipal,
    auditContext: AuditRequestContext
  ) {
    let scopeType: SupportConfigScope = SupportConfigScope.GLOBAL;
    let companyId: string | null = null;

    if (principal.role === Role.CLIENT_ADMIN) {
      const clientCompany = this.assertClientAdminCompany(principal);
      scopeType = SupportConfigScope.COMPANY;
      companyId = clientCompany.companyId;

      if (input.companySlug && principal.companySlug && normalizeSlug(input.companySlug) !== principal.companySlug) {
        throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
      }
    } else if (input.companySlug) {
      const company = await this.resolveCompanyBySlug(input.companySlug);
      scopeType = SupportConfigScope.COMPANY;
      companyId = company.id;
    }

    const scopeKey = this.buildScopeKey({
      scopeType,
      companyId
    });

    const payload = {
      enabled: input.enabled,
      whatsappLink: input.whatsappLink,
      supportEmail: input.supportEmail,
      helpCenterUrl: input.helpCenterUrl,
      company: companyId
        ? {
            connect: {
              id: companyId
            }
          }
        : {
            disconnect: true
          }
    } satisfies Prisma.SupportConfigUpdateInput;

    const saved = await prisma.supportConfig.upsert({
      where: {
        scopeKey
      },
      update: {
        ...payload,
        updatedByUser: {
          connect: {
            id: principal.id
          }
        }
      },
      create: {
        scopeType,
        scopeKey,
        enabled: input.enabled,
        whatsappLink: input.whatsappLink,
        supportEmail: input.supportEmail,
        helpCenterUrl: input.helpCenterUrl,
        ...(companyId ? { companyId } : {}),
        createdByUserId: principal.id,
        updatedByUserId: principal.id
      },
      select: supportConfigSelect
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'SUPPORT_CONFIG_UPSERTED',
      companyId: companyId ?? undefined,
      targetType: 'SUPPORT_CONFIG',
      targetId: saved.id,
      requestId: auditContext.requestId,
      ipAddress: auditContext.ipAddress ?? undefined,
      userAgent: auditContext.userAgent ?? undefined,
      metadata: {
        scopeType,
        enabled: saved.enabled,
        hasWhatsappLink: Boolean(saved.whatsappLink),
        hasSupportEmail: Boolean(saved.supportEmail),
        hasHelpCenterUrl: Boolean(saved.helpCenterUrl)
      }
    });

    return saved;
  }

  async getPublicSupportConfig(companySlugRaw?: string) {
    if (companySlugRaw) {
      const company = await this.resolveCompanyBySlug(companySlugRaw);

      const companyConfig = await this.findScopeConfig({
        scopeType: SupportConfigScope.COMPANY,
        companyId: company.id
      });

      if (companyConfig?.enabled) {
        return {
          config: {
            scopeType: 'COMPANY' as const,
            company: companyConfig.company,
            whatsappLink: companyConfig.whatsappLink,
            supportEmail: companyConfig.supportEmail,
            helpCenterUrl: companyConfig.helpCenterUrl
          }
        };
      }
    }

    const globalConfig = await this.findScopeConfig({
      scopeType: SupportConfigScope.GLOBAL
    });

    if (!globalConfig?.enabled) {
      return {
        config: null
      };
    }

    return {
      config: {
        scopeType: 'GLOBAL' as const,
        company: null,
        whatsappLink: globalConfig.whatsappLink,
        supportEmail: globalConfig.supportEmail,
        helpCenterUrl: globalConfig.helpCenterUrl
      }
    };
  }
}
