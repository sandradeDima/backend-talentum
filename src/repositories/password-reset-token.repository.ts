import type { PasswordResetToken, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class PasswordResetTokenRepository {
  async create(
    input: {
      userId: string;
      token: string;
      expiresAt: Date;
      createdByAdminId: string;
    },
    tx: Prisma.TransactionClient
  ): Promise<PasswordResetToken> {
    return tx.passwordResetToken.create({
      data: {
        userId: input.userId,
        token: input.token,
        expiresAt: input.expiresAt,
        createdByAdminId: input.createdByAdminId
      }
    });
  }

  async findByTokenHash(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({
      where: {
        token: tokenHash
      },
      include: {
        user: {
          include: {
            company: true
          }
        }
      }
    });
  }

  async revokePendingByUserId(userId: string, tx: Prisma.TransactionClient) {
    return tx.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async markUsed(id: string, tx: Prisma.TransactionClient) {
    return tx.passwordResetToken.update({
      where: {
        id
      },
      data: {
        usedAt: new Date()
      }
    });
  }
}
