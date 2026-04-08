import { CompanyStatus, Role, UserActivationStatus } from '@prisma/client';
import type { IncomingHttpHeaders } from 'http';
import { AppError } from '../errors/appError';
import { hashPassword } from '../lib/auth';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { InvitationRepository } from '../repositories/invitation.repository';
import { UserRepository } from '../repositories/user.repository';
import type { AcceptInvitationDto } from '../dto/invitation.dto';
import { BetterAuthService } from './better-auth.service';
import { sha256 } from '../utils/hash';

export class InvitationService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly userRepository: UserRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly betterAuthService: BetterAuthService
  ) {}

  private assertInvitationIsUsable(
    invitation: Awaited<ReturnType<InvitationRepository['findByTokenHash']>>
  ) {
    if (!invitation) {
      throw new AppError('Invitación inválida', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.revokedAt) {
      throw new AppError('Esta invitación fue revocada', 410, 'INVITATION_REVOKED');
    }

    if (invitation.acceptedAt) {
      throw new AppError('Esta invitación ya fue aceptada', 409, 'INVITATION_ALREADY_ACCEPTED');
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new AppError('La invitación expiró', 410, 'INVITATION_EXPIRED');
    }

    if (invitation.role !== Role.CLIENT_ADMIN) {
      throw new AppError(
        'Solo está soportada la invitación para CLIENT_ADMIN',
        400,
        'INVITATION_ROLE_UNSUPPORTED'
      );
    }

    if (invitation.company.status === CompanyStatus.INACTIVE) {
      throw new AppError('La empresa está inactiva', 403, 'COMPANY_INACTIVE');
    }

    return invitation;
  }

  async validateInvitationToken(rawToken: string) {
    const tokenHash = sha256(rawToken);
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);
    const validInvitation = this.assertInvitationIsUsable(invitation);

    return {
      email: validInvitation.email,
      role: validInvitation.role,
      expiresAt: validInvitation.expiresAt,
      company: {
        id: validInvitation.company.id,
        name: validInvitation.company.name,
        slug: validInvitation.company.slug,
        logoUrl: validInvitation.company.logoUrl,
        status: validInvitation.company.status
      }
    };
  }

  async acceptInvitation(input: AcceptInvitationDto, headers: IncomingHttpHeaders) {
    const tokenHash = sha256(input.token);
    const invitation = this.assertInvitationIsUsable(
      await this.invitationRepository.findByTokenHash(tokenHash)
    );

    const passwordHash = await hashPassword(input.password);

    const transactionResult = await prisma.$transaction(async (tx) => {
      const existingUser = await this.userRepository.findByEmail(invitation.email);
      let activeUserId: string;

      if (existingUser) {
        if (
          existingUser.role !== Role.CLIENT_ADMIN ||
          existingUser.companyId !== invitation.companyId
        ) {
          throw new AppError(
            'Ya existe un usuario con este correo en otro contexto',
            409,
            'USER_ALREADY_EXISTS'
          );
        }

        if (
          existingUser.activationStatus === UserActivationStatus.ACTIVO &&
          existingUser.isActive
        ) {
          throw new AppError('Esta cuenta ya fue activada', 409, 'USER_ALREADY_ACTIVE');
        }

        await this.userRepository.updateById(
          existingUser.id,
          {
            name: input.name.trim(),
            passwordHash,
            emailVerified: true,
            isActive: true,
            activationStatus: UserActivationStatus.ACTIVO,
            lastLoginAt: new Date(),
            role: Role.CLIENT_ADMIN,
            company: {
              connect: {
                id: invitation.companyId
              }
            }
          },
          tx
        );

        await this.userRepository.upsertCredentialAccount(existingUser.id, passwordHash, tx);
        activeUserId = existingUser.id;
      } else {
        const createdUser = await this.userRepository.createClientAdminWithCredential(
          {
            name: input.name,
            email: invitation.email,
            passwordHash,
            companyId: invitation.companyId
          },
          tx
        );

        activeUserId = createdUser.id;
      }

      await this.invitationRepository.markAccepted(invitation.id, tx);

      await this.companyRepository.updateById(
        invitation.companyId,
        {
          status: CompanyStatus.ACTIVE
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: invitation.createdByAdminId,
          action: 'INVITATION_ACCEPTED',
          companyId: invitation.companyId,
          targetType: 'USER',
          targetId: activeUserId,
          metadata: {
            invitationId: invitation.id,
            acceptedEmail: invitation.email
          }
        },
        tx
      );

      return {
        userId: activeUserId
      };
    });

    const loginResult = await this.betterAuthService.signInWithEmail({
      email: invitation.email,
      password: input.password,
      rememberMe: true,
      headers
    });

    const company = await this.companyRepository.findById(invitation.companyId);

    return {
      ...loginResult,
      response: {
        ...loginResult.response,
        user: {
          id: transactionResult.userId,
          name: input.name.trim(),
          email: invitation.email,
          role: Role.CLIENT_ADMIN,
          companyId: invitation.companyId,
          isActive: true,
          companySlug: company?.slug ?? null
        },
        company
      }
    };
  }
}
