import { type Prisma, type PrismaClient, type SurveyCampaignStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const surveySummarySelect = {
  id: true,
  companyId: true,
  slug: true,
  name: true,
  templateKey: true,
  status: true,
  startDate: true,
  endDate: true,
  initialSendScheduledAt: true,
  remindersLockedAt: true,
  finalizedAt: true,
  tutorialVideoUrl: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.SurveyCampaignSelect;

const surveyDetailSelect = {
  ...surveySummarySelect,
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
  closingText: true,
  tutorialVideoUrl: true,
  reminders: {
    select: {
      id: true,
      scheduledAt: true,
      createdAt: true
    },
    orderBy: {
      scheduledAt: 'asc'
    }
  },
  reminderSchedules: {
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      attemptCount: true,
      lastAttemptAt: true,
      processedAt: true,
      nextRetryAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      scheduledAt: 'asc'
    }
  }
} satisfies Prisma.SurveyCampaignSelect;

const globalSurveySummarySelect = {
  ...surveySummarySelect,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true
    }
  }
} satisfies Prisma.SurveyCampaignSelect;

export type SurveyCampaignSummaryRow = Prisma.SurveyCampaignGetPayload<{
  select: typeof surveySummarySelect;
}>;

export type SurveyCampaignDetailRow = Prisma.SurveyCampaignGetPayload<{
  select: typeof surveyDetailSelect;
}>;

export type GlobalSurveyCampaignSummaryRow = Prisma.SurveyCampaignGetPayload<{
  select: typeof globalSurveySummarySelect;
}>;

const getDbClient = (tx?: Prisma.TransactionClient): PrismaClient | Prisma.TransactionClient => {
  return tx ?? prisma;
};

export class SurveyRepository {
  async listByCompanyId(companyId: string): Promise<SurveyCampaignSummaryRow[]> {
    return prisma.surveyCampaign.findMany({
      where: { companyId },
      orderBy: {
        createdAt: 'desc'
      },
      select: surveySummarySelect
    });
  }

  async listGlobalWithFilters(input: {
    page: number;
    pageSize: number;
    search?: string;
    company?: string;
    status?: SurveyCampaignStatus;
  }) {
    const where: Prisma.SurveyCampaignWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.company
        ? {
            company: {
              is: {
                OR: [
                  { slug: { contains: input.company } },
                  { name: { contains: input.company } }
                ]
              }
            }
          }
        : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search } },
              { slug: { contains: input.search } },
              { company: { is: { name: { contains: input.search } } } },
              { company: { is: { slug: { contains: input.search } } } }
            ]
          }
        : {})
    };

    const skip = (input.page - 1) * input.pageSize;

    const orderBy =
      input.status === 'FINALIZADA'
        ? [{ finalizedAt: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const [rows, total] = await Promise.all([
      prisma.surveyCampaign.findMany({
        where,
        skip,
        take: input.pageSize,
        orderBy,
        select: globalSurveySummarySelect
      }),
      prisma.surveyCampaign.count({ where })
    ]);

    return {
      rows,
      total
    };
  }

  async findByCompanyIdAndSlug(
    companyId: string,
    slug: string
  ): Promise<SurveyCampaignDetailRow | null> {
    return prisma.surveyCampaign.findFirst({
      where: {
        companyId,
        slug
      },
      select: surveyDetailSelect
    });
  }

  async findBySlug(slug: string): Promise<SurveyCampaignDetailRow | null> {
    return prisma.surveyCampaign.findUnique({
      where: { slug },
      select: surveyDetailSelect
    });
  }

  async create(
    data: {
      companyId: string;
      slug: string;
      name: string;
      templateKey: Prisma.SurveyCampaignCreateInput['templateKey'];
      status: SurveyCampaignStatus;
      createdByAdminId: string;
      startDate: Date;
      endDate: Date;
      introGeneral: string;
      leaderIntro: string;
      leaderQuestions: string[];
      leaderExtraQuestion: string | null;
      teamIntro: string;
      teamQuestions: string[];
      teamExtraQuestion: string | null;
      organizationIntro: string;
      organizationQuestions: string[];
      organizationExtraQuestion: string | null;
      finalNpsQuestion: string;
      finalOpenQuestion: string;
      closingText: string;
      tutorialVideoUrl: string | null;
    },
    tx?: Prisma.TransactionClient
  ): Promise<SurveyCampaignDetailRow> {
    const db = getDbClient(tx);
    return db.surveyCampaign.create({
      data,
      select: surveyDetailSelect
    });
  }

  async updateById(
    id: string,
    data: Prisma.SurveyCampaignUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<SurveyCampaignDetailRow> {
    const db = getDbClient(tx);
    return db.surveyCampaign.update({
      where: { id },
      data,
      select: surveyDetailSelect
    });
  }

  async replaceReminders(
    surveyCampaignId: string,
    scheduledAtList: Date[],
    tx: Prisma.TransactionClient
  ): Promise<void> {
    await tx.surveyReminder.deleteMany({
      where: { surveyCampaignId }
    });

    await tx.surveyReminder.createMany({
      data: scheduledAtList.map((scheduledAt) => ({
        surveyCampaignId,
        scheduledAt,
        targetNotStarted: true,
        targetNotFinished: true
      }))
    });
  }
}
