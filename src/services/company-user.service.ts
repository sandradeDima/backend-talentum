import { Role, UserActivationStatus, type Prisma } from '@prisma/client';
import { env } from '../config/env';
import type {
  CreateCompanyUserDto,
  ListGlobalCompanyUsersQueryDto,
  UpdateCompanyUserDto
} from '../dto/company-user.dto';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { InvitationRepository } from '../repositories/invitation.repository';
import {
  type CompanyAdminUserRow,
  type GlobalCompanyAdminUserRow,
  UserRepository
} from '../repositories/user.repository';
import type { SessionPrincipal } from '../types/auth';
import { randomToken, sha256 } from '../utils/hash';
import { normalizeSlug } from '../utils/slug';
import { MailService } from './mail.service';
import { PasswordResetService } from './password-reset.service';

const CLIENT_ADMIN_ROLE = Role.CLIENT_ADMIN;

const buildFullName = (user: { name: string; lastName: string | null }) => {
  const parts = [user.name, user.lastName ?? ''].map((value) => value.trim()).filter(Boolean);
  return parts.join(' ');
};

export class CompanyUserService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly invitationRepository: InvitationRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly mailService: MailService,
    private readonly passwordResetService: PasswordResetService
  ) {}

  private assertAdmin(principal: SessionPrincipal) {
    if (principal.role !== Role.ADMIN) {
      throw new AppError('Solo ADMIN puede gestionar usuarios de empresa', 403, 'ROLE_FORBIDDEN');
    }
  }

  private assertCompanyScope(principal: SessionPrincipal, companyId: string) {
    if (principal.role === Role.CLIENT_ADMIN && principal.companyId !== companyId) {
      throw new AppError('Acceso denegado a esta empresa', 403, 'COMPANY_SCOPE_FORBIDDEN');
    }
  }

  private buildInvitationExpirationDate(): Date {
    const hours = env.INVITATION_TOKEN_EXPIRES_HOURS;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private async resolveCompanyBySlug(companySlug: string, principal: SessionPrincipal) {
    const normalizedSlug = normalizeSlug(companySlug);

    if (!normalizedSlug || normalizedSlug.length < 2) {
      throw new AppError('Slug inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const company = await this.companyRepository.findBySlugForAdmin(normalizedSlug);

    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    this.assertCompanyScope(principal, company.id);
    return company;
  }

  private async resolveCompanyUser(companyId: string, userId: string) {
    const user = await this.userRepository.findCompanyAdminById(companyId, userId);

    if (!user) {
      throw new AppError('Usuario de empresa no encontrado', 404, 'COMPANY_USER_NOT_FOUND');
    }

    return user;
  }

  private serializeCompanyUser(user: CompanyAdminUserRow) {
    const hasCredentialAccess = user.accounts.some(
      (account) => account.providerId === 'credential' && Boolean(account.password)
    );
    const hasGoogleLinked = user.accounts.some((account) => account.providerId === 'google');
    const hasMicrosoftLinked = user.accounts.some(
      (account) => account.providerId === 'microsoft'
    );
    const hasSocialAccess = hasGoogleLinked || hasMicrosoftLinked;
    const isSocialOnly = hasSocialAccess && !hasCredentialAccess;
    const accessModeLabel =
      user.activationStatus === UserActivationStatus.PENDIENTE_ACTIVACION
        ? 'Pendiente de activación'
        : isSocialOnly
          ? 'Solo acceso social'
          : hasCredentialAccess && hasSocialAccess
            ? 'Contraseña + social'
            : hasCredentialAccess
              ? 'Acceso con contraseña'
              : 'Sin acceso configurado';

    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      fullName: buildFullName(user),
      email: user.email,
      phone: user.phone,
      role: user.role,
      activationStatus: user.activationStatus,
      isActive: user.isActive,
      status: user.activationStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      hasCredentialAccess,
      hasGoogleLinked,
      hasMicrosoftLinked,
      hasSocialAccess,
      isSocialOnly,
      accessModeLabel,
      canResendInvite: user.activationStatus === UserActivationStatus.PENDIENTE_ACTIVACION,
      canResetPassword: user.activationStatus === UserActivationStatus.ACTIVO && hasCredentialAccess
    };
  }

  private serializeGlobalCompanyUser(user: GlobalCompanyAdminUserRow) {
    const serialized = this.serializeCompanyUser(user);

    return {
      ...serialized,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
            status: user.company.status
          }
        : null
    };
  }

  private async createInvitationInTransaction(input: {
    tx: Prisma.TransactionClient;
    companyId: string;
    email: string;
    createdByAdminId: string;
  }) {
    await this.invitationRepository.revokePendingByCompanyAndEmail(
      input.companyId,
      input.email,
      input.tx
    );

    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const expiresAt = this.buildInvitationExpirationDate();

    const invitation = await this.invitationRepository.create(
      {
        email: input.email,
        token: tokenHash,
        companyId: input.companyId,
        role: CLIENT_ADMIN_ROLE,
        expiresAt,
        createdByAdminId: input.createdByAdminId
      },
      input.tx
    );

    return {
      rawToken,
      invitation
    };
  }

  async listByCompanySlug(companySlug: string, principal: SessionPrincipal) {
    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const users = await this.userRepository.listCompanyAdmins(company.id);

    return {
      company: {
        id: company.id,
        slug: company.slug,
        name: company.name
      },
      rows: users.map((user) => this.serializeCompanyUser(user))
    };
  }

  async listGlobalUsers(query: ListGlobalCompanyUsersQueryDto, principal: SessionPrincipal) {
    this.assertAdmin(principal);

    const result = await this.userRepository.listCompanyAdminsGlobal({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      company: query.company,
      activationStatus: query.activationStatus
    });

    return {
      rows: result.rows.map((row) => this.serializeGlobalCompanyUser(row)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize))
      }
    };
  }

  async createCompanyUser(
    companySlug: string,
    input: CreateCompanyUserDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const normalizedEmail = input.email.toLowerCase();

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('Ya existe un usuario con este correo', 409, 'COMPANY_USER_EMAIL_ALREADY_EXISTS');
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const user = await this.userRepository.createPendingCompanyAdmin(
        {
          name: input.name.trim(),
          lastName: input.lastName.trim(),
          email: normalizedEmail,
          phone: input.phone.trim(),
          role: CLIENT_ADMIN_ROLE,
          companyId: company.id
        },
        tx
      );

      const inviteData = await this.createInvitationInTransaction({
        tx,
        companyId: company.id,
        email: normalizedEmail,
        createdByAdminId: principal.id
      });

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'COMPANY_USER_CREATED',
          companyId: company.id,
          targetType: 'USER',
          targetId: user.id,
          metadata: {
            email: normalizedEmail,
            role: CLIENT_ADMIN_ROLE
          }
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'INVITATION_CREATED',
          companyId: company.id,
          targetType: 'INVITATION',
          targetId: inviteData.invitation.id,
          metadata: {
            userId: user.id,
            email: normalizedEmail
          }
        },
        tx
      );

      return {
        user,
        invitation: inviteData.invitation,
        rawToken: inviteData.rawToken
      };
    });

    await this.mailService.sendInvitationEmail({
      to: normalizedEmail,
      companyName: company.name,
      rawToken: transactionResult.rawToken,
      expiresAt: transactionResult.invitation.expiresAt
    });

    return {
      user: this.serializeCompanyUser(transactionResult.user),
      invitation: {
        id: transactionResult.invitation.id,
        email: transactionResult.invitation.email,
        expiresAt: transactionResult.invitation.expiresAt
      }
    };
  }

  async updateCompanyUser(
    companySlug: string,
    userId: string,
    input: UpdateCompanyUserDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const user = await this.resolveCompanyUser(company.id, userId);

    const nextEmail = input.email?.toLowerCase();
    if (nextEmail && nextEmail !== user.email) {
      const emailOwner = await this.userRepository.findByEmail(nextEmail);
      if (emailOwner && emailOwner.id !== user.id) {
        throw new AppError('Ya existe un usuario con este correo', 409, 'COMPANY_USER_EMAIL_ALREADY_EXISTS');
      }
    }

    if (
      input.activationStatus === UserActivationStatus.ACTIVO &&
      !user.passwordHash
    ) {
      throw new AppError(
        'No puedes activar manualmente un usuario pendiente. Debe aceptar la invitación.',
        409,
        'USER_ACTIVATION_REQUIRES_INVITATION'
      );
    }

    const updated = await this.userRepository.updateById(user.id, {
      name: input.name?.trim(),
      lastName: input.lastName?.trim(),
      email: nextEmail,
      phone: input.phone?.trim(),
      role: input.role,
      activationStatus: input.activationStatus,
      isActive:
        input.activationStatus === UserActivationStatus.ACTIVO
          ? true
          : input.activationStatus
            ? false
            : undefined
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'COMPANY_USER_UPDATED',
      companyId: company.id,
      targetType: 'USER',
      targetId: user.id,
      metadata: {
        payload: input
      }
    });

    return this.serializeCompanyUser(updated);
  }

  async deactivateCompanyUser(
    companySlug: string,
    userId: string,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const user = await this.resolveCompanyUser(company.id, userId);

    if (user.activationStatus === UserActivationStatus.INACTIVO && !user.isActive) {
      return this.serializeCompanyUser(user);
    }

    const updated = await this.userRepository.updateById(user.id, {
      activationStatus: UserActivationStatus.INACTIVO,
      isActive: false
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'COMPANY_USER_DEACTIVATED',
      companyId: company.id,
      targetType: 'USER',
      targetId: user.id,
      metadata: {
        previousStatus: user.activationStatus
      }
    });

    return this.serializeCompanyUser(updated);
  }

  async resendInvitation(
    companySlug: string,
    userId: string,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const user = await this.resolveCompanyUser(company.id, userId);

    if (user.activationStatus !== UserActivationStatus.PENDIENTE_ACTIVACION) {
      throw new AppError(
        'Solo se puede reenviar invitación a usuarios pendientes de activación',
        409,
        'USER_INVITE_RESEND_NOT_ALLOWED'
      );
    }

    const inviteData = await prisma.$transaction(async (tx) => {
      const created = await this.createInvitationInTransaction({
        tx,
        companyId: company.id,
        email: user.email,
        createdByAdminId: principal.id
      });

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'INVITATION_RESENT',
          companyId: company.id,
          targetType: 'INVITATION',
          targetId: created.invitation.id,
          metadata: {
            userId: user.id,
            email: user.email
          }
        },
        tx
      );

      return created;
    });

    await this.mailService.sendInvitationEmail({
      to: user.email,
      companyName: company.name,
      rawToken: inviteData.rawToken,
      expiresAt: inviteData.invitation.expiresAt
    });

    return {
      invitationId: inviteData.invitation.id,
      email: user.email,
      expiresAt: inviteData.invitation.expiresAt
    };
  }

  async resetPassword(
    companySlug: string,
    userId: string,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const user = await this.resolveCompanyUser(company.id, userId);

    if (user.activationStatus !== UserActivationStatus.ACTIVO || !user.isActive) {
      throw new AppError(
        'Solo se puede resetear contraseña de usuarios activos',
        409,
        'USER_RESET_PASSWORD_NOT_ALLOWED'
      );
    }

    if (!user.passwordHash) {
      throw new AppError(
        'Este usuario no tiene credenciales locales para resetear contraseña',
        409,
        'USER_SOCIAL_ONLY'
      );
    }

    const result = await this.passwordResetService.issueResetByAdmin({
      userId: user.id,
      actorUserId: principal.id
    });

    await this.auditLogRepository.create({
      actorUserId: principal.id,
      action: 'COMPANY_USER_PASSWORD_RESET_SENT',
      companyId: company.id,
      targetType: 'USER',
      targetId: user.id,
      metadata: {
        email: user.email
      }
    });

    return result;
  }
}
