-- AlterTable
ALTER TABLE `SurveyCampaign`
    ADD COLUMN `initialSendStatus` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NULL,
    ADD COLUMN `initialSendAttemptCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `initialSendLastAttemptAt` DATETIME(3) NULL,
    ADD COLUMN `initialSendProcessedAt` DATETIME(3) NULL,
    ADD COLUMN `initialSendNextRetryAt` DATETIME(3) NULL,
    ADD COLUMN `initialSendLockToken` VARCHAR(191) NULL,
    ADD COLUMN `initialSendErrorMessage` TEXT NULL;

-- Preserve existing scheduled campaigns without re-sending old campaigns retroactively.
UPDATE `SurveyCampaign`
SET
    `initialSendStatus` = CASE
        WHEN `initialSendScheduledAt` > CURRENT_TIMESTAMP(3) THEN 'PENDING'
        ELSE 'COMPLETED'
    END,
    `initialSendProcessedAt` = CASE
        WHEN `initialSendScheduledAt` > CURRENT_TIMESTAMP(3) THEN NULL
        ELSE CURRENT_TIMESTAMP(3)
    END
WHERE `initialSendScheduledAt` IS NOT NULL;

-- CreateTable
CREATE TABLE `InitialInvitationDispatch` (
    `id` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `respondentId` VARCHAR(191) NOT NULL,
    `accessCredentialId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NULL,
    `lastAttemptAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InitialInvitationDispatch_idempotencyKey_key`(`idempotencyKey`),
    INDEX `InitialInvitationDispatch_surveyCampaignId_status_idx`(`surveyCampaignId`, `status`),
    INDEX `InitialInvitationDispatch_respondentId_idx`(`respondentId`),
    INDEX `InitialInvitationDispatch_accessCredentialId_idx`(`accessCredentialId`),
    UNIQUE INDEX `InitialInvitationDispatch_surveyCampaignId_respondentId_key`(`surveyCampaignId`, `respondentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `SurveyCampaign_initialSendScheduledAt_initialSendStatus_idx` ON `SurveyCampaign`(`initialSendScheduledAt`, `initialSendStatus`);

-- CreateIndex
CREATE INDEX `SurveyCampaign_initialSendNextRetryAt_idx` ON `SurveyCampaign`(`initialSendNextRetryAt`);

-- AddForeignKey
ALTER TABLE `InitialInvitationDispatch` ADD CONSTRAINT `InitialInvitationDispatch_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InitialInvitationDispatch` ADD CONSTRAINT `InitialInvitationDispatch_respondentId_fkey` FOREIGN KEY (`respondentId`) REFERENCES `Respondent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InitialInvitationDispatch` ADD CONSTRAINT `InitialInvitationDispatch_accessCredentialId_fkey` FOREIGN KEY (`accessCredentialId`) REFERENCES `RespondentAccessCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
