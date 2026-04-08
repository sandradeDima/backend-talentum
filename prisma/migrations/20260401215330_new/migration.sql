-- CreateTable
CREATE TABLE `Respondent` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Respondent_companyId_idx`(`companyId`),
    INDEX `Respondent_surveyCampaignId_idx`(`surveyCampaignId`),
    INDEX `Respondent_email_idx`(`email`),
    INDEX `Respondent_isActive_idx`(`isActive`),
    UNIQUE INDEX `Respondent_surveyCampaignId_identifier_key`(`surveyCampaignId`, `identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RespondentAccessCredential` (
    `id` VARCHAR(191) NOT NULL,
    `respondentId` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `credentialType` ENUM('TOKEN', 'PIN') NOT NULL,
    `tokenHash` VARCHAR(191) NULL,
    `pinHash` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `validatedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RespondentAccessCredential_tokenHash_key`(`tokenHash`),
    INDEX `RespondentAccessCredential_respondentId_idx`(`respondentId`),
    INDEX `RespondentAccessCredential_surveyCampaignId_idx`(`surveyCampaignId`),
    INDEX `RespondentAccessCredential_credentialType_idx`(`credentialType`),
    INDEX `RespondentAccessCredential_expiresAt_idx`(`expiresAt`),
    INDEX `RespondentAccessCredential_consumedAt_idx`(`consumedAt`),
    INDEX `RespondentAccessCredential_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyResponse` (
    `id` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `respondentId` VARCHAR(191) NOT NULL,
    `accessCredentialId` VARCHAR(191) NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED') NOT NULL DEFAULT 'NOT_STARTED',
    `sessionTokenHash` VARCHAR(191) NULL,
    `sessionExpiresAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `lastActivityAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SurveyResponse_respondentId_key`(`respondentId`),
    UNIQUE INDEX `SurveyResponse_sessionTokenHash_key`(`sessionTokenHash`),
    INDEX `SurveyResponse_surveyCampaignId_idx`(`surveyCampaignId`),
    INDEX `SurveyResponse_status_idx`(`status`),
    INDEX `SurveyResponse_sessionExpiresAt_idx`(`sessionExpiresAt`),
    INDEX `SurveyResponse_submittedAt_idx`(`submittedAt`),
    INDEX `SurveyResponse_accessCredentialId_idx`(`accessCredentialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `surveyResponseId` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `questionKey` VARCHAR(191) NOT NULL,
    `sectionKey` VARCHAR(191) NULL,
    `value` JSON NOT NULL,
    `answeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SurveyAnswer_surveyCampaignId_idx`(`surveyCampaignId`),
    INDEX `SurveyAnswer_sectionKey_idx`(`sectionKey`),
    UNIQUE INDEX `SurveyAnswer_surveyResponseId_questionKey_key`(`surveyResponseId`, `questionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReminderSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `surveyCampaignId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastAttemptAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `lockToken` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReminderSchedule_surveyCampaignId_idx`(`surveyCampaignId`),
    INDEX `ReminderSchedule_scheduledAt_status_idx`(`scheduledAt`, `status`),
    INDEX `ReminderSchedule_nextRetryAt_idx`(`nextRetryAt`),
    UNIQUE INDEX `ReminderSchedule_surveyCampaignId_scheduledAt_key`(`surveyCampaignId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReminderDispatch` (
    `id` VARCHAR(191) NOT NULL,
    `reminderScheduleId` VARCHAR(191) NOT NULL,
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

    UNIQUE INDEX `ReminderDispatch_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ReminderDispatch_surveyCampaignId_status_idx`(`surveyCampaignId`, `status`),
    INDEX `ReminderDispatch_respondentId_idx`(`respondentId`),
    INDEX `ReminderDispatch_accessCredentialId_idx`(`accessCredentialId`),
    UNIQUE INDEX `ReminderDispatch_reminderScheduleId_respondentId_key`(`reminderScheduleId`, `respondentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Respondent` ADD CONSTRAINT `Respondent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Respondent` ADD CONSTRAINT `Respondent_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RespondentAccessCredential` ADD CONSTRAINT `RespondentAccessCredential_respondentId_fkey` FOREIGN KEY (`respondentId`) REFERENCES `Respondent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RespondentAccessCredential` ADD CONSTRAINT `RespondentAccessCredential_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_respondentId_fkey` FOREIGN KEY (`respondentId`) REFERENCES `Respondent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_accessCredentialId_fkey` FOREIGN KEY (`accessCredentialId`) REFERENCES `RespondentAccessCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_surveyResponseId_fkey` FOREIGN KEY (`surveyResponseId`) REFERENCES `SurveyResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReminderSchedule` ADD CONSTRAINT `ReminderSchedule_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReminderDispatch` ADD CONSTRAINT `ReminderDispatch_reminderScheduleId_fkey` FOREIGN KEY (`reminderScheduleId`) REFERENCES `ReminderSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReminderDispatch` ADD CONSTRAINT `ReminderDispatch_surveyCampaignId_fkey` FOREIGN KEY (`surveyCampaignId`) REFERENCES `SurveyCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReminderDispatch` ADD CONSTRAINT `ReminderDispatch_respondentId_fkey` FOREIGN KEY (`respondentId`) REFERENCES `Respondent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReminderDispatch` ADD CONSTRAINT `ReminderDispatch_accessCredentialId_fkey` FOREIGN KEY (`accessCredentialId`) REFERENCES `RespondentAccessCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
