import { Role } from '@prisma/client';
import type { UpsertCoolturaConfigDto } from '../dto/cooltura-config.dto';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import type { SessionPrincipal } from '../types/auth';

const SINGLETON_ID = 'cooltura_global';

const configSelect = {
  linkedinUrl: true,
  youtubeUrl: true,
  instagramUrl: true,
  facebookUrl: true,
  tiktokUrl: true,
  whatsappLink: true,
  boliviaDireccion: true,
  boliviaTelefono: true,
  boliviaEmail: true,
  paraguayDireccion: true,
  paraguayTelefono: true,
  paraguayEmail: true,
  updatedAt: true
} as const;

export class CoolturaConfigService {
  private assertAdmin(principal: SessionPrincipal) {
    if (principal.role !== Role.ADMIN) {
      throw new AppError(
        'Solo ADMIN puede gestionar la configuración de Cooltura',
        403,
        'COOLTURA_CONFIG_ADMIN_REQUIRED'
      );
    }
  }

  async getConfig(principal: SessionPrincipal) {
    this.assertAdmin(principal);

    const config = await prisma.coolturaConfig.findUnique({
      where: { id: SINGLETON_ID },
      select: configSelect
    });

    return config ?? this.emptyConfig();
  }

  async upsertConfig(input: UpsertCoolturaConfigDto, principal: SessionPrincipal) {
    this.assertAdmin(principal);

    const config = await prisma.coolturaConfig.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        ...input,
        updatedByUserId: principal.id
      },
      update: {
        ...input,
        updatedByUserId: principal.id
      },
      select: configSelect
    });

    return config;
  }

  private emptyConfig() {
    return {
      linkedinUrl: null,
      youtubeUrl: null,
      instagramUrl: null,
      facebookUrl: null,
      tiktokUrl: null,
      whatsappLink: null,
      boliviaDireccion: null,
      boliviaTelefono: null,
      boliviaEmail: null,
      paraguayDireccion: null,
      paraguayTelefono: null,
      paraguayEmail: null,
      updatedAt: null as Date | null
    };
  }
}
