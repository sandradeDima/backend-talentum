-- AlterTable
ALTER TABLE `SurveyReminder`
    ADD COLUMN `targetNotStarted` TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN `targetNotFinished` TINYINT(1) NOT NULL DEFAULT 1;
