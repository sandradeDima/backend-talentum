import { Role, type Invitation, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class InvitationRepository {
  async create(
    input: {
      email: string;
      token: string;
      companyId: string;
      role?: Role;
      expiresAt: Date;
      createdByAdminId: string;
    },
    tx: Prisma.TransactionClient
  ): Promise<Invitation> {
    return tx.invitation.create({
      data: {
        email: input.email.toLowerCase(),
        token: input.token,
        companyId: input.companyId,
        role: input.role ?? Role.CLIENT_ADMIN,
        expiresAt: input.expiresAt,
        createdByAdminId: input.createdByAdminId
      }
    });
  }

  async findByTokenHash(tokenHash: string) {
    return prisma.invitation.findUnique({
      where: { token: tokenHash },
      include: {
        company: true
      }
    });
  }

  async markAccepted(id: string, tx: Prisma.TransactionClient) {
    return tx.invitation.update({
      where: { id },
      data: {
        acceptedAt: new Date()
      }
    });
  }

  async revokePendingByCompanyAndEmail(
    companyId: string,
    email: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.invitation.updateMany({
      where: {
        companyId,
        email: email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
}
