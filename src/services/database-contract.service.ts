import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const REQUIRED_TABLES = ['DashboardExportJob'] as const;

const REQUIRED_COLUMNS_BY_TABLE: Record<string, readonly string[]> = {
  Respondent: ['gerencia', 'centro'],
  DashboardExportJob: [
    'id',
    'surveyCampaignId',
    'requestedByUserId',
    'status',
    'groupBy',
    'attemptCount',
    'maxAttempts',
    'startedAt',
    'completedAt',
    'nextRetryAt',
    'filePath',
    'fileUrl',
    'errorMessage',
    'createdAt',
    'updatedAt'
  ]
};

const REQUIRED_INDEXES_BY_TABLE: Record<string, readonly string[]> = {
  Respondent: [
    'Respondent_surveyCampaignId_gerencia_idx',
    'Respondent_surveyCampaignId_centro_idx'
  ],
  SurveyResponse: [
    'SurveyResponse_surveyCampaignId_status_idx',
    'SurveyResponse_surveyCampaignId_submittedAt_idx'
  ],
  SurveyAnswer: ['SurveyAnswer_surveyCampaignId_questionKey_idx'],
  DashboardExportJob: [
    'DashboardExportJob_surveyCampaignId_status_idx',
    'DashboardExportJob_requestedByUserId_createdAt_idx',
    'DashboardExportJob_status_nextRetryAt_idx'
  ]
};

const readExistingTables = async (tableNames: readonly string[]) => {
  const rows = await prisma.$queryRaw<Array<{ tableName: string }>>(Prisma.sql`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${Prisma.join(tableNames)})
  `);

  return new Set(rows.map((row) => row.tableName));
};

const readExistingColumns = async (tableName: string, columnNames: readonly string[]) => {
  const rows = await prisma.$queryRaw<Array<{ columnName: string }>>(Prisma.sql`
    SELECT COLUMN_NAME AS columnName
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME IN (${Prisma.join(columnNames)})
  `);

  return new Set(rows.map((row) => row.columnName));
};

const readExistingIndexes = async (tableName: string, indexNames: readonly string[]) => {
  const rows = await prisma.$queryRaw<Array<{ indexName: string }>>(Prisma.sql`
    SELECT DISTINCT INDEX_NAME AS indexName
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND INDEX_NAME IN (${Prisma.join(indexNames)})
  `);

  return new Set(rows.map((row) => row.indexName));
};

export const assertDatabaseSchemaContract = async () => {
  const missing: string[] = [];

  const existingTables = await readExistingTables(REQUIRED_TABLES);
  for (const tableName of REQUIRED_TABLES) {
    if (!existingTables.has(tableName)) {
      missing.push(`table:${tableName}`);
    }
  }

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS_BY_TABLE)) {
    const existingColumns = await readExistingColumns(tableName, requiredColumns);
    for (const columnName of requiredColumns) {
      if (!existingColumns.has(columnName)) {
        missing.push(`column:${tableName}.${columnName}`);
      }
    }
  }

  for (const [tableName, requiredIndexes] of Object.entries(REQUIRED_INDEXES_BY_TABLE)) {
    const existingIndexes = await readExistingIndexes(tableName, requiredIndexes);
    for (const indexName of requiredIndexes) {
      if (!existingIndexes.has(indexName)) {
        missing.push(`index:${tableName}.${indexName}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        'Database schema contract check failed.',
        'Missing artifacts:',
        ...missing.map((item) => `- ${item}`),
        'Apply migrations with `npm run prisma:deploy` and restart the service.'
      ].join('\n')
    );
  }
};
