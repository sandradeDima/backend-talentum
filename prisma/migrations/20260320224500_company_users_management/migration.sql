-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `lastName` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `activationStatus` ENUM('PENDIENTE_ACTIVACION', 'ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- Backfill activation status from current activity flag
UPDATE `User`
SET `activationStatus` = CASE
    WHEN `isActive` = 1 THEN 'ACTIVO'
    ELSE 'INACTIVO'
END;

-- AlterTable
ALTER TABLE `Company`
    CHANGE COLUMN `managerEmail` `contactEmail` VARCHAR(191) NOT NULL;

-- DropIndex
DROP INDEX `Company_managerEmail_idx` ON `Company`;

-- CreateIndex
CREATE INDEX `Company_contactEmail_idx` ON `Company`(`contactEmail`);

-- CreateIndex
CREATE INDEX `User_activationStatus_idx` ON `User`(`activationStatus`);

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdByAdminId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    INDEX `PasswordResetToken_createdByAdminId_idx`(`createdByAdminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
