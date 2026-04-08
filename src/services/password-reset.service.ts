import { Role, UserActivationStatus } from '@prisma/client';
import { env } from '../config/env';
import type { ConfirmPasswordResetDto } from '../dto/password-reset.dto';
import { AppError } from '../errors/appError';
import { hashPassword } from '../lib/auth';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { randomToken, sha256 } from '../utils/hash';
import { MailService } from './mail.service';

export class PasswordResetService {
  constructor(
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly mailService: MailService
  ) {}

  private buildResetExpirationDate(): Date {
    const hours = env.PASSWORD_RESET_TOKEN_EXPIRES_HOURS;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private assertResetTokenIsUsable(
    tokenRecord: Awaited<
      ReturnType<PasswordResetTokenRepository['findByTokenHash']>
    >
  ) {
    if (!tokenRecord) {
      throw new AppError('Token de recuperación inválido', 404, 'PASSWORD_RESET_TOKEN_NOT_FOUND');
    }

    if (tokenRecord.revokedAt) {
      throw new AppError('El token de recuperación fue revocado', 410, 'PASSWORD_RESET_REVOKED');
    }

    if (tokenRecord.usedAt) {
      throw new AppError('El token de recuperación ya fue utilizado', 409, 'PASSWORD_RESET_ALREADY_USED');
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new AppError('El token de recuperación expiró', 410, 'PASSWORD_RESET_EXPIRED');
    }

    if (tokenRecord.user.activationStatus === UserActivationStatus.INACTIVO) {
      throw new AppError('El usuario está inactivo', 403, 'USER_INACTIVE');
    }

    return tokenRecord;
  }

  async issueResetByAdmin(input: { userId: string; actorUserId: string }) {
    const user = await this.userRepository.findById(input.userId);

    if (!user || !user.companyId || user.role !== Role.CLIENT_ADMIN) {
      throw new AppError('Usuario no encontrado', 404, 'COMPANY_USER_NOT_FOUND');
    }

    if (user.activationStatus === UserActivationStatus.PENDIENTE_ACTIVACION) {
      throw new AppError(
        'El usuario aún no activó su cuenta. Usa Reenviar invitación.',
        409,
        'USER_PENDING_ACTIVATION'
      );
    }

    if (user.activationStatus === UserActivationStatus.INACTIVO || !user.isActive) {
      throw new AppError('No se puede resetear contraseña de un usuario inactivo', 409, 'USER_INACTIVE');
    }

    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const expiresAt = this.buildResetExpirationDate();

    await prisma.$transaction(async (tx) => {
      await this.passwordResetTokenRepository.revokePendingByUserId(user.id, tx);

      const token = await this.passwordResetTokenRepository.create(
        {
          userId: user.id,
          token: tokenHash,
          expiresAt,
          createdByAdminId: input.actorUserId
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: input.actorUserId,
          action: 'USER_PASSWORD_RESET_REQUESTED',
          companyId: user.companyId ?? undefined,
          targetType: 'PASSWORD_RESET_TOKEN',
          targetId: token.id,
          metadata: {
            userId: user.id,
            email: user.email
          }
        },
        tx
      );
    });

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      companyName: user.company?.name ?? 'Talentum',
      rawToken,
      expiresAt
    });

    return {
      email: user.email,
      expiresAt
    };
  }

  async validateToken(rawToken: string) {
    const tokenHash = sha256(rawToken);
    const tokenRecord = this.assertResetTokenIsUsable(
      await this.passwordResetTokenRepository.findByTokenHash(tokenHash)
    );

    return {
      email: tokenRecord.user.email,
      expiresAt: tokenRecord.expiresAt,
      company: tokenRecord.user.company
        ? {
            id: tokenRecord.user.company.id,
            name: tokenRecord.user.company.name,
            slug: tokenRecord.user.company.slug
          }
        : null
    };
  }

  async confirmReset(input: ConfirmPasswordResetDto) {
    const tokenHash = sha256(input.token);
    const tokenRecord = this.assertResetTokenIsUsable(
      await this.passwordResetTokenRepository.findByTokenHash(tokenHash)
    );

    const passwordHash = await hashPassword(input.password);

    await prisma.$transaction(async (tx) => {
      await this.userRepository.updateById(
        tokenRecord.userId,
        {
          passwordHash,
          emailVerified: true,
          isActive: true,
          activationStatus: UserActivationStatus.ACTIVO
        },
        tx
      );

      await this.userRepository.upsertCredentialAccount(tokenRecord.userId, passwordHash, tx);
      await this.passwordResetTokenRepository.markUsed(tokenRecord.id, tx);

      await this.auditLogRepository.create(
        {
          actorUserId: tokenRecord.userId,
          action: 'USER_PASSWORD_RESET_COMPLETED',
          companyId: tokenRecord.user.companyId ?? undefined,
          targetType: 'USER',
          targetId: tokenRecord.userId,
          metadata: {
            tokenId: tokenRecord.id
          }
        },
        tx
      );
    });

    return {
      email: tokenRecord.user.email
    };
  }
}
