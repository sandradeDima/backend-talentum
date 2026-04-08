import {
  RespondentCredentialType,
  SurveyCampaignStatus,
  SurveyResponseStatus,
  type Prisma
} from '@prisma/client';
import { env } from '../config/env';
import type { ValidateSurveyAccessDto } from '../dto/survey-access.dto';
import type {
  AutosaveSurveyResponseDto,
  SurveyAnswerInputDto,
  StartSurveyResponseDto,
  SubmitSurveyResponseDto
} from '../dto/survey-response.dto';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import { randomToken, sha256 } from '../utils/hash';
import { normalizeSlug } from '../utils/slug';

const SURVEY_SESSION_DURATION_MS =
  env.SURVEY_RESPONSE_SESSION_EXPIRES_HOURS * 60 * 60 * 1000;
const COOLTURA_CONFIG_ID = 'cooltura_global';

const campaignContextSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true,
  tutorialVideoUrl: true,
  introGeneral: true,
  leaderIntro: true,
  leaderQuestions: true,
  leaderExtraQuestion: true,
  teamIntro: true,
  teamQuestions: true,
  teamExtraQuestion: true,
  organizationIntro: true,
  organizationQuestions: true,
  organizationExtraQuestion: true,
  finalNpsQuestion: true,
  finalOpenQuestion: true,
  closingText: true
} satisfies Prisma.SurveyCampaignSelect;

const responseLifecycleSelect = {
  id: true,
  status: true,
  startedAt: true,
  lastActivityAt: true,
  submittedAt: true,
  sessionExpiresAt: true
} satisfies Prisma.SurveyResponseSelect;

const accessCredentialContextSelect = {
  id: true,
  respondentId: true,
  surveyCampaignId: true,
  credentialType: true,
  expiresAt: true,
  validatedAt: true,
  consumedAt: true,
  revokedAt: true,
  respondent: {
    select: {
      id: true,
      identifier: true,
      fullName: true,
      isActive: true,
      response: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          lastActivityAt: true,
          submittedAt: true
        }
      }
    }
  },
  surveyCampaign: {
    select: campaignContextSelect
  }
} satisfies Prisma.RespondentAccessCredentialSelect;

const respondentAccessContextSelect = {
  id: true,
  identifier: true,
  fullName: true,
  isActive: true,
  response: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      lastActivityAt: true,
      submittedAt: true
    }
  },
  surveyCampaign: {
    select: campaignContextSelect
  }
} satisfies Prisma.RespondentSelect;

const surveySessionContextSelect = {
  id: true,
  surveyCampaignId: true,
  respondentId: true,
  accessCredentialId: true,
  status: true,
  startedAt: true,
  lastActivityAt: true,
  submittedAt: true,
  sessionExpiresAt: true,
  surveyCampaign: {
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      leaderExtraQuestion: true,
      teamExtraQuestion: true,
      organizationExtraQuestion: true
    }
  },
  respondent: {
    select: {
      id: true,
      identifier: true,
      fullName: true,
      isActive: true
    }
  },
  accessCredential: {
    select: {
      id: true,
      expiresAt: true,
      consumedAt: true,
      revokedAt: true
    }
  }
} satisfies Prisma.SurveyResponseSelect;


type AccessCredentialContextRow = Prisma.RespondentAccessCredentialGetPayload<{
  select: typeof accessCredentialContextSelect;
}>;

type RespondentAccessContextRow = Prisma.RespondentGetPayload<{
  select: typeof respondentAccessContextSelect;
}>;

type SurveySessionContextRow = Prisma.SurveyResponseGetPayload<{
  select: typeof surveySessionContextSelect;
}>;

type CampaignContextRow = Prisma.SurveyCampaignGetPayload<{
  select: typeof campaignContextSelect;
}>;

const parseQuestionArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new AppError(
      'Configuración de encuesta inválida',
      500,
      `INVALID_SURVEY_CONTENT_${field}`
    );
  }

  return value;
};

export class SurveyExecutionService {
  private parseNumericScore(value: Prisma.JsonValue): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  private hasAnsweredValue(value: Prisma.JsonValue): boolean {
    if (value === null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (typeof value === 'boolean') {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return false;
  }

  private normalizeCampaignSlug(rawValue: string): string {
    const slug = normalizeSlug(rawValue);

    if (!slug || slug.length < 2) {
      throw new AppError(
        'Slug de encuesta inválido',
        400,
        'INVALID_SURVEY_CAMPAIGN_SLUG'
      );
    }

    return slug;
  }

  private buildSessionExpiration(now: Date): Date {
    return new Date(now.getTime() + SURVEY_SESSION_DURATION_MS);
  }

  private assertCampaignIsAvailable(campaign: {
    status: SurveyCampaignStatus;
    startDate: Date;
    endDate: Date;
  }) {
    if (campaign.status === SurveyCampaignStatus.BORRADOR) {
      throw new AppError(
        'La encuesta todavía no está habilitada',
        403,
        'SURVEY_CAMPAIGN_NOT_AVAILABLE'
      );
    }

    if (campaign.status === SurveyCampaignStatus.FINALIZADA) {
      throw new AppError('La encuesta ya finalizó', 410, 'SURVEY_CAMPAIGN_FINISHED');
    }

    const now = Date.now();

    if (campaign.startDate.getTime() > now) {
      throw new AppError('La encuesta aún no inició', 403, 'SURVEY_CAMPAIGN_NOT_STARTED');
    }

    if (campaign.endDate.getTime() < now) {
      throw new AppError('La encuesta ya finalizó', 410, 'SURVEY_CAMPAIGN_DATE_FINISHED');
    }
  }

  private assertCredentialIsUsable(
    credential: AccessCredentialContextRow | null
  ): AccessCredentialContextRow {
    if (!credential) {
      throw new AppError(
        'Credencial de acceso inválida',
        401,
        'RESPONDENT_ACCESS_INVALID'
      );
    }

    if (credential.revokedAt) {
      throw new AppError(
        'La credencial de acceso fue revocada',
        410,
        'RESPONDENT_ACCESS_REVOKED'
      );
    }

    if (credential.consumedAt) {
      throw new AppError(
        'Esta credencial ya fue utilizada para enviar la encuesta',
        409,
        'RESPONDENT_ACCESS_CONSUMED'
      );
    }

    if (credential.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        'La credencial de acceso expiró',
        410,
        'RESPONDENT_ACCESS_EXPIRED'
      );
    }

    if (!credential.respondent.isActive) {
      throw new AppError('El colaborador está inactivo', 403, 'RESPONDENT_INACTIVE');
    }

    if (
      credential.respondent.response &&
      (credential.respondent.response.submittedAt ||
        credential.respondent.response.status === SurveyResponseStatus.SUBMITTED)
    ) {
      throw new AppError(
        'La encuesta ya fue enviada por este colaborador',
        409,
        'SURVEY_RESPONSE_ALREADY_SUBMITTED'
      );
    }

    this.assertCampaignIsAvailable(credential.surveyCampaign);

    return credential;
  }

  private assertRespondentIsUsable(
    respondent: RespondentAccessContextRow | null
  ): RespondentAccessContextRow {
    if (!respondent) {
      throw new AppError(
        'Credencial de acceso inválida',
        401,
        'RESPONDENT_ACCESS_INVALID'
      );
    }

    if (!respondent.isActive) {
      throw new AppError('El colaborador está inactivo', 403, 'RESPONDENT_INACTIVE');
    }

    if (
      respondent.response &&
      (respondent.response.submittedAt ||
        respondent.response.status === SurveyResponseStatus.SUBMITTED)
    ) {
      throw new AppError(
        'La encuesta ya fue enviada por este colaborador',
        409,
        'SURVEY_RESPONSE_ALREADY_SUBMITTED'
      );
    }

    this.assertCampaignIsAvailable(respondent.surveyCampaign);

    return respondent;
  }

  private mapCampaignContext(campaign: CampaignContextRow) {
    return {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      tutorialVideoUrl: campaign.tutorialVideoUrl,
      content: {
        introGeneral: campaign.introGeneral,
        leaderIntro: campaign.leaderIntro,
        leaderQuestions: parseQuestionArray(campaign.leaderQuestions, 'leaderQuestions'),
        leaderExtraQuestion: campaign.leaderExtraQuestion,
        teamIntro: campaign.teamIntro,
        teamQuestions: parseQuestionArray(campaign.teamQuestions, 'teamQuestions'),
        teamExtraQuestion: campaign.teamExtraQuestion,
        organizationIntro: campaign.organizationIntro,
        organizationQuestions: parseQuestionArray(
          campaign.organizationQuestions,
          'organizationQuestions'
        ),
        organizationExtraQuestion: campaign.organizationExtraQuestion,
        finalNpsQuestion: campaign.finalNpsQuestion,
        finalOpenQuestion: campaign.finalOpenQuestion,
        closingText: campaign.closingText
      }
    };
  }

  async getPublicEntryBranding(rawCampaignSlug: string) {
    const campaignSlug = this.normalizeCampaignSlug(rawCampaignSlug);

    const [campaign, config] = await Promise.all([
      prisma.surveyCampaign.findUnique({
        where: {
          slug: campaignSlug
        },
        select: {
          id: true,
          slug: true,
          name: true,
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              supportWhatsappPhone: true
            }
          }
        }
      }),
      prisma.coolturaConfig.findUnique({
        where: {
          id: COOLTURA_CONFIG_ID
        },
        select: {
          linkedinUrl: true,
          youtubeUrl: true,
          instagramUrl: true,
          facebookUrl: true,
          tiktokUrl: true,
          boliviaDireccion: true,
          boliviaTelefono: true,
          boliviaEmail: true,
          paraguayDireccion: true,
          paraguayTelefono: true,
          paraguayEmail: true
        }
      })
    ]);

    if (!campaign) {
      throw new AppError('Encuesta no encontrada', 404, 'SURVEY_CAMPAIGN_NOT_FOUND');
    }

    const locations = [
      {
        country: 'Bolivia',
        address: config?.boliviaDireccion ?? null,
        phone: config?.boliviaTelefono ?? null,
        email: config?.boliviaEmail ?? null
      },
      {
        country: 'Paraguay',
        address: config?.paraguayDireccion ?? null,
        phone: config?.paraguayTelefono ?? null,
        email: config?.paraguayEmail ?? null
      }
    ]
      .filter((location) => Boolean(location.address || location.phone || location.email))
      .map((location) => ({
        country: location.country,
        address: location.address ?? '',
        phone: location.phone,
        email: location.email
      }));

    return {
      companyName: campaign.company.name,
      topRightLogoUrl: campaign.company.logoUrl,
      supportWhatsappPhone: campaign.company.supportWhatsappPhone,
      socialLinks: {
        linkedin: config?.linkedinUrl ?? null,
        youtube: config?.youtubeUrl ?? null,
        instagram: config?.instagramUrl ?? null,
        facebook: config?.facebookUrl ?? null,
        tiktok: config?.tiktokUrl ?? null,
        spotify: null
      },
      locations
    };
  }

  private async findCredentialByInput(
    input: ValidateSurveyAccessDto
  ): Promise<AccessCredentialContextRow | null> {
    const campaignSlug = this.normalizeCampaignSlug(input.campaignSlug);
    const credentialHash = sha256(input.credential);

    if (input.credentialType === RespondentCredentialType.TOKEN) {
      return prisma.respondentAccessCredential.findFirst({
        where: {
          credentialType: RespondentCredentialType.TOKEN,
          tokenHash: credentialHash,
          surveyCampaign: {
            slug: campaignSlug
          }
        },
        select: accessCredentialContextSelect
      });
    }

    return prisma.respondentAccessCredential.findFirst({
      where: {
        credentialType: RespondentCredentialType.PIN,
        pinHash: credentialHash,
        surveyCampaign: {
          slug: campaignSlug
        }
      },
      select: accessCredentialContextSelect
    });
  }

  private async findRespondentByAccessCode(
    input: ValidateSurveyAccessDto
  ): Promise<RespondentAccessContextRow | null> {
    const campaignSlug = this.normalizeCampaignSlug(input.campaignSlug);

    return prisma.respondent.findFirst({
      where: {
        identifier: input.credential,
        surveyCampaign: {
          slug: campaignSlug
        }
      },
      select: respondentAccessContextSelect
    });
  }

  private async resolveActiveSession(rawSessionToken: string): Promise<SurveySessionContextRow> {
    const sessionTokenHash = sha256(rawSessionToken);
    const response = await prisma.surveyResponse.findFirst({
      where: {
        sessionTokenHash
      },
      select: surveySessionContextSelect
    });

    if (!response) {
      throw new AppError('Sesión de encuesta inválida', 401, 'SURVEY_SESSION_INVALID');
    }

    const now = Date.now();
    if (!response.sessionExpiresAt || response.sessionExpiresAt.getTime() < now) {
      await prisma.surveyResponse
        .update({
          where: { id: response.id },
          data: {
            sessionTokenHash: null,
            sessionExpiresAt: null
          }
        })
        .catch(() => {
          return null;
        });

      throw new AppError('Sesión de encuesta expirada', 401, 'SURVEY_SESSION_EXPIRED');
    }

    if (!response.respondent.isActive) {
      throw new AppError('El colaborador está inactivo', 403, 'RESPONDENT_INACTIVE');
    }

    this.assertCampaignIsAvailable(response.surveyCampaign);

    if (response.submittedAt || response.status === SurveyResponseStatus.SUBMITTED) {
      throw new AppError(
        'La encuesta ya fue enviada',
        409,
        'SURVEY_RESPONSE_ALREADY_SUBMITTED'
      );
    }

    if (response.accessCredential) {
      if (response.accessCredential.revokedAt) {
        throw new AppError(
          'La credencial de acceso fue revocada',
          410,
          'RESPONDENT_ACCESS_REVOKED'
        );
      }

      if (response.accessCredential.consumedAt) {
        throw new AppError(
          'La encuesta ya fue enviada con esta credencial',
          409,
          'RESPONDENT_ACCESS_CONSUMED'
        );
      }

      if (response.accessCredential.expiresAt.getTime() < now) {
        throw new AppError(
          'La credencial de acceso expiró',
          410,
          'RESPONDENT_ACCESS_EXPIRED'
        );
      }
    }

    return response;
  }

  private async persistAnswers(
    tx: Prisma.TransactionClient,
    input: {
      surveyResponseId: string;
      surveyCampaignId: string;
      answers: SurveyAnswerInputDto[];
      answeredAt: Date;
    }
  ) {
    await Promise.all(
      input.answers.map((answer) =>
        tx.surveyAnswer.upsert({
          where: {
            surveyResponseId_questionKey: {
              surveyResponseId: input.surveyResponseId,
              questionKey: answer.questionKey
            }
          },
          update: {
            sectionKey: answer.sectionKey ?? null,
            value: answer.value as Prisma.InputJsonValue,
            answeredAt: input.answeredAt
          },
          create: {
            surveyResponseId: input.surveyResponseId,
            surveyCampaignId: input.surveyCampaignId,
            questionKey: answer.questionKey,
            sectionKey: answer.sectionKey ?? null,
            value: answer.value as Prisma.InputJsonValue,
            answeredAt: input.answeredAt
          }
        })
      )
    );
  }

  async validateAccess(input: ValidateSurveyAccessDto) {
    const now = new Date();
    const rawSessionToken = randomToken(48);
    const sessionTokenHash = sha256(rawSessionToken);
    const sessionExpiresAt = this.buildSessionExpiration(now);
    const isMagicLink = input.credentialType === RespondentCredentialType.TOKEN;

    if (isMagicLink) {
      const credential = this.assertCredentialIsUsable(
        await this.findCredentialByInput(input)
      );

      const response = await prisma.$transaction(async (tx) => {
        const existingResponse = await tx.surveyResponse.findUnique({
          where: {
            respondentId: credential.respondentId
          },
          select: {
            id: true,
            status: true,
            submittedAt: true
          }
        });

        if (
          existingResponse &&
          (existingResponse.submittedAt ||
            existingResponse.status === SurveyResponseStatus.SUBMITTED)
        ) {
          throw new AppError(
            'La encuesta ya fue enviada por este colaborador',
            409,
            'SURVEY_RESPONSE_ALREADY_SUBMITTED'
          );
        }

        let persistedResponse;

        if (existingResponse) {
          const updated = await tx.surveyResponse.updateMany({
            where: {
              id: existingResponse.id,
              submittedAt: null
            },
            data: {
              accessCredentialId: credential.id,
              sessionTokenHash,
              sessionExpiresAt,
              lastActivityAt: now
            }
          });

          if (updated.count === 0) {
            throw new AppError(
              'La encuesta ya fue enviada',
              409,
              'SURVEY_RESPONSE_ALREADY_SUBMITTED'
            );
          }

          persistedResponse = await tx.surveyResponse.findUniqueOrThrow({
            where: {
              id: existingResponse.id
            },
            select: responseLifecycleSelect
          });
        } else {
          persistedResponse = await tx.surveyResponse.create({
            data: {
              surveyCampaignId: credential.surveyCampaignId,
              respondentId: credential.respondentId,
              accessCredentialId: credential.id,
              status: SurveyResponseStatus.NOT_STARTED,
              sessionTokenHash,
              sessionExpiresAt,
              lastActivityAt: now
            },
            select: responseLifecycleSelect
          });
        }

        await tx.respondentAccessCredential.update({
          where: {
            id: credential.id
          },
          data: {
            validatedAt: now
          }
        });

        return persistedResponse;
      });

      return {
        sessionToken: rawSessionToken,
        sessionExpiresAt,
        campaign: this.mapCampaignContext(credential.surveyCampaign),
        respondent: {
          id: credential.respondent.id,
          identifier: credential.respondent.identifier,
          fullName: credential.respondent.fullName
        },
        response
      };
    }

    const respondent = this.assertRespondentIsUsable(
      await this.findRespondentByAccessCode(input)
    );

    const response = await prisma.$transaction(async (tx) => {
      const existingResponse = await tx.surveyResponse.findUnique({
        where: {
          respondentId: respondent.id
        },
        select: {
          id: true,
          status: true,
          submittedAt: true
        }
      });

      if (
        existingResponse &&
        (existingResponse.submittedAt ||
          existingResponse.status === SurveyResponseStatus.SUBMITTED)
      ) {
        throw new AppError(
          'La encuesta ya fue enviada por este colaborador',
          409,
          'SURVEY_RESPONSE_ALREADY_SUBMITTED'
        );
      }

      if (existingResponse) {
        const updated = await tx.surveyResponse.updateMany({
          where: {
            id: existingResponse.id,
            submittedAt: null
          },
          data: {
            accessCredentialId: null,
            sessionTokenHash,
            sessionExpiresAt,
            lastActivityAt: now
          }
        });

        if (updated.count === 0) {
          throw new AppError(
            'La encuesta ya fue enviada',
            409,
            'SURVEY_RESPONSE_ALREADY_SUBMITTED'
          );
        }

        return tx.surveyResponse.findUniqueOrThrow({
          where: {
            id: existingResponse.id
          },
          select: responseLifecycleSelect
        });
      }

      return tx.surveyResponse.create({
        data: {
          surveyCampaignId: respondent.surveyCampaign.id,
          respondentId: respondent.id,
          accessCredentialId: null,
          status: SurveyResponseStatus.NOT_STARTED,
          sessionTokenHash,
          sessionExpiresAt,
          lastActivityAt: now
        },
        select: responseLifecycleSelect
      });
    });

    return {
      sessionToken: rawSessionToken,
      sessionExpiresAt,
      campaign: this.mapCampaignContext(respondent.surveyCampaign),
      respondent: {
        id: respondent.id,
        identifier: respondent.identifier,
        fullName: respondent.fullName
      },
      response
    };
  }

  async startSurveyResponse(input: StartSurveyResponseDto) {
    const session = await this.resolveActiveSession(input.sessionToken);
    const now = new Date();
    const sessionExpiresAt = this.buildSessionExpiration(now);

    const response = await prisma.surveyResponse.update({
      where: {
        id: session.id
      },
      data: {
        status: SurveyResponseStatus.IN_PROGRESS,
        startedAt: session.startedAt ?? now,
        lastActivityAt: now,
        sessionExpiresAt
      },
      select: responseLifecycleSelect
    });

    return {
      response,
      sessionExpiresAt
    };
  }

  async autosaveSurveyResponse(input: AutosaveSurveyResponseDto) {
    const session = await this.resolveActiveSession(input.sessionToken);
    const now = new Date();
    const sessionExpiresAt = this.buildSessionExpiration(now);

    await prisma.$transaction(async (tx) => {
      await tx.surveyResponse.update({
        where: {
          id: session.id
        },
        data: {
          status: SurveyResponseStatus.IN_PROGRESS,
          startedAt: session.startedAt ?? now,
          lastActivityAt: now,
          sessionExpiresAt
        }
      });

      await this.persistAnswers(tx, {
        surveyResponseId: session.id,
        surveyCampaignId: session.surveyCampaignId,
        answers: input.answers,
        answeredAt: now
      });
    });

    const persistedAnswers = await prisma.surveyAnswer.findMany({
      where: {
        surveyResponseId: session.id
      },
      select: {
        questionKey: true,
        sectionKey: true,
        value: true
      }
    });

    return {
      responseId: session.id,
      status: SurveyResponseStatus.IN_PROGRESS,
      savedAnswers: input.answers.length,
      lastActivityAt: now,
      sessionExpiresAt
    };
  }

  async submitSurveyResponse(input: SubmitSurveyResponseDto) {
    const session = await this.resolveActiveSession(input.sessionToken);
    const now = new Date();
    const submittedAnswers = input.answers ?? [];

    await prisma.$transaction(async (tx) => {
      if (submittedAnswers.length > 0) {
        await this.persistAnswers(tx, {
          surveyResponseId: session.id,
          surveyCampaignId: session.surveyCampaignId,
          answers: submittedAnswers,
          answeredAt: now
        });
      }

      const updated = await tx.surveyResponse.updateMany({
        where: {
          id: session.id,
          submittedAt: null
        },
        data: {
          status: SurveyResponseStatus.SUBMITTED,
          startedAt: session.startedAt ?? now,
          lastActivityAt: now,
          submittedAt: now,
          sessionTokenHash: null,
          sessionExpiresAt: now
        }
      });

      if (updated.count === 0) {
        throw new AppError(
          'La encuesta ya fue enviada',
          409,
          'SURVEY_RESPONSE_ALREADY_SUBMITTED'
        );
      }

      if (session.accessCredentialId) {
        await tx.respondentAccessCredential.updateMany({
          where: {
            id: session.accessCredentialId,
            consumedAt: null
          },
          data: {
            consumedAt: now
          }
        });
      }
    });

    return {
      responseId: session.id,
      status: SurveyResponseStatus.SUBMITTED,
      submittedAt: now
    };
  }
}
