-- Add explicit finalized timestamp for historical reporting workflows.
-- This migration is additive and safe for existing data.

SET @db := DATABASE();

SET @add_survey_campaign_finalized_at := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'SurveyCampaign'
        AND COLUMN_NAME = 'finalizedAt'
    ),
    'SELECT 1',
    'ALTER TABLE `SurveyCampaign`
      ADD COLUMN `finalizedAt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @add_survey_campaign_finalized_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill finalized timestamp for campaigns already marked FINALIZADA.
UPDATE `SurveyCampaign`
SET `finalizedAt` = COALESCE(`finalizedAt`, `updatedAt`)
WHERE `status` = 'FINALIZADA';

SET @add_survey_campaign_finalized_at_idx := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'SurveyCampaign'
        AND INDEX_NAME = 'SurveyCampaign_finalizedAt_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `SurveyCampaign_finalizedAt_idx`
      ON `SurveyCampaign`(`finalizedAt`)'
  )
);
PREPARE stmt FROM @add_survey_campaign_finalized_at_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
