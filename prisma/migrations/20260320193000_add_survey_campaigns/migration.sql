-- CreateTable
CREATE TABLE `SurveyCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `templateKey` ENUM('BASE_CLIMA_V1') NOT NULL DEFAULT 'BASE_CLIMA_V1',
    `status` ENUM('BORRADOR', 'CREADA', 'EN_PROCESO', 'FINALIZADA') NOT NULL DEFAULT 'BORRADOR',
    `createdByAdminId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `initialSendScheduledAt` DATETIME(3) NULL,
    `remindersLockedAt` DATETIME(3) NULL,
    `introGeneral` TEXT NOT NULL,
    `leaderIntro` TEXT NOT NULL,
    `leaderQuestions` JSON NOT NULL,
    `leaderExtraQuestion` TEXT NULL,
    `teamIntro` TEXT NOT NULL,
    `teamQuestions` JSON NOT NULL,
    `teamExtraQuestion` TEXT NULL,
    `organizationIntro` TEXT NOT NULL,
    `organizationQuestions` JSON NOT NULL,
    `organizationExtraQuestion` TEXT NULL,
    `finalNpsQuestion` TEXT NOT NULL,
    `finalOpenQuestion` TEXT NOT NULL,
    `closingText` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SurveyCampaign_slug_key`(`slug`),
    INDEX `SurveyCampaign_companyId_idx`(`companyId`),
    INDEX `SurveyCampaign_status_idx`(`status`),
    INDEX `SurveyCampaign_createdByAdminId_idx`(`createdByAdminId`),
    INDEX `SurveyCampaign_startDate_idx`(`startDate`),
    INDEX `SurveyCampaign_endDate_idx`(`endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyReminder` (
    `id` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SurveyReminder_surveyCampaignId_idx`(`surveyCampaignId`),
    INDEX `SurveyReminder_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SurveyCampaign` ADD CONSTRAINT `SurveyCampaign_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyCampaign` ADD CONSTRAINT `SurveyCampaign_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyReminder` ADD CONSTRAINT `SurveyReminder_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
