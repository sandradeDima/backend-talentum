-- This migration is intentionally additive and forward-safe.
-- It aligns migration history with runtime model expectations without dropping data.

SET @db := DATABASE();

-- Add missing Respondent segmentation columns expected by survey operations/dashboard queries.
SET @add_respondent_gerencia := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'Respondent'
        AND COLUMN_NAME = 'gerencia'
    ),
    'SELECT 1',
    'ALTER TABLE `Respondent` ADD COLUMN `gerencia` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @add_respondent_gerencia;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_respondent_centro := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'Respondent'
        AND COLUMN_NAME = 'centro'
    ),
    'SELECT 1',
    'ALTER TABLE `Respondent` ADD COLUMN `centro` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @add_respondent_centro;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create dashboard export job table required by dashboard export worker/runtime.
SET @create_dashboard_export_job := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
    ),
    'SELECT 1',
    'CREATE TABLE `DashboardExportJob` (
      `id` VARCHAR(191) NOT NULL,
      `surveyCampaignId` VARCHAR(191) NOT NULL,
      `requestedByUserId` VARCHAR(191) NOT NULL,
      `status` ENUM(''PENDING'', ''PROCESSING'', ''COMPLETED'', ''FAILED'') NOT NULL DEFAULT ''PENDING'',
      `groupBy` ENUM(''COMPANY'', ''GERENCIA'', ''CENTRO'') NOT NULL,
      `attemptCount` INTEGER NOT NULL DEFAULT 0,
      `maxAttempts` INTEGER NOT NULL DEFAULT 3,
      `startedAt` DATETIME(3) NULL,
      `completedAt` DATETIME(3) NULL,
      `nextRetryAt` DATETIME(3) NULL,
      `filePath` VARCHAR(191) NULL,
      `fileUrl` VARCHAR(191) NULL,
      `errorMessage` TEXT NULL,
      `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      `updatedAt` DATETIME(3) NOT NULL,
      PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
  )
);
PREPARE stmt FROM @create_dashboard_export_job;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- For environments where DashboardExportJob was created manually/partially,
-- add any missing columns before applying keys/indexes.
-- Some columns are added nullable in this repair path to avoid blocking deploys on
-- existing rows; application writes still provide non-null values for new records.
SET @add_dashboard_export_job_survey_campaign_id := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'surveyCampaignId'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `surveyCampaignId` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_survey_campaign_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_requested_by_user_id := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'requestedByUserId'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `requestedByUserId` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_requested_by_user_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_status := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'status'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `status` ENUM(''PENDING'', ''PROCESSING'', ''COMPLETED'', ''FAILED'')
      NOT NULL DEFAULT ''PENDING'''
  )
);
PREPARE stmt FROM @add_dashboard_export_job_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_group_by := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'groupBy'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `groupBy` ENUM(''COMPANY'', ''GERENCIA'', ''CENTRO'') NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_group_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_attempt_count := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'attemptCount'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_attempt_count;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_max_attempts := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'maxAttempts'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `maxAttempts` INTEGER NOT NULL DEFAULT 3'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_max_attempts;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_started_at := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'startedAt'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `startedAt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_started_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_completed_at := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'completedAt'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `completedAt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_completed_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_next_retry_at := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'nextRetryAt'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `nextRetryAt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_next_retry_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_file_path := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'filePath'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `filePath` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_file_path;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_file_url := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'fileUrl'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `fileUrl` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_file_url;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_error_message := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'errorMessage'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `errorMessage` TEXT NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_error_message;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_created_at := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'createdAt'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_created_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_updated_at := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND COLUMN_NAME = 'updatedAt'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD COLUMN `updatedAt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_updated_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure foreign keys exist even if table was created outside migration history.
SET @add_dashboard_export_job_survey_fk := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND CONSTRAINT_NAME = 'DashboardExportJob_surveyCampaignId_fkey'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD CONSTRAINT `DashboardExportJob_surveyCampaignId_fkey`
      FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_survey_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_job_requested_by_fk := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND CONSTRAINT_NAME = 'DashboardExportJob_requestedByUserId_fkey'
    ),
    'SELECT 1',
    'ALTER TABLE `DashboardExportJob`
      ADD CONSTRAINT `DashboardExportJob_requestedByUserId_fkey`
      FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE'
  )
);
PREPARE stmt FROM @add_dashboard_export_job_requested_by_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add missing indexes required by schema/runtime query patterns.
SET @add_respondent_survey_gerencia_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'Respondent'
        AND INDEX_NAME = 'Respondent_surveyCampaignId_gerencia_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `Respondent_surveyCampaignId_gerencia_idx`
      ON `Respondent`(`surveyCampaignId`, `gerencia`)'
  )
);
PREPARE stmt FROM @add_respondent_survey_gerencia_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_respondent_survey_centro_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'Respondent'
        AND INDEX_NAME = 'Respondent_surveyCampaignId_centro_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `Respondent_surveyCampaignId_centro_idx`
      ON `Respondent`(`surveyCampaignId`, `centro`)'
  )
);
PREPARE stmt FROM @add_respondent_survey_centro_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_survey_response_campaign_status_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'SurveyResponse'
        AND INDEX_NAME = 'SurveyResponse_surveyCampaignId_status_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `SurveyResponse_surveyCampaignId_status_idx`
      ON `SurveyResponse`(`surveyCampaignId`, `status`)'
  )
);
PREPARE stmt FROM @add_survey_response_campaign_status_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_survey_response_campaign_submitted_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'SurveyResponse'
        AND INDEX_NAME = 'SurveyResponse_surveyCampaignId_submittedAt_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `SurveyResponse_surveyCampaignId_submittedAt_idx`
      ON `SurveyResponse`(`surveyCampaignId`, `submittedAt`)'
  )
);
PREPARE stmt FROM @add_survey_response_campaign_submitted_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_survey_answer_campaign_question_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'SurveyAnswer'
        AND INDEX_NAME = 'SurveyAnswer_surveyCampaignId_questionKey_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `SurveyAnswer_surveyCampaignId_questionKey_idx`
      ON `SurveyAnswer`(`surveyCampaignId`, `questionKey`)'
  )
);
PREPARE stmt FROM @add_survey_answer_campaign_question_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_campaign_status_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND INDEX_NAME = 'DashboardExportJob_surveyCampaignId_status_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `DashboardExportJob_surveyCampaignId_status_idx`
      ON `DashboardExportJob`(`surveyCampaignId`, `status`)'
  )
);
PREPARE stmt FROM @add_dashboard_export_campaign_status_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_requested_by_created_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND INDEX_NAME = 'DashboardExportJob_requestedByUserId_createdAt_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `DashboardExportJob_requestedByUserId_createdAt_idx`
      ON `DashboardExportJob`(`requestedByUserId`, `createdAt`)'
  )
);
PREPARE stmt FROM @add_dashboard_export_requested_by_created_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_dashboard_export_status_retry_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'DashboardExportJob'
        AND INDEX_NAME = 'DashboardExportJob_status_nextRetryAt_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `DashboardExportJob_status_nextRetryAt_idx`
      ON `DashboardExportJob`(`status`, `nextRetryAt`)'
  )
);
PREPARE stmt FROM @add_dashboard_export_status_retry_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
