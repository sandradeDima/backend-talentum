-- AlterTable
ALTER TABLE `AuditLog`
  ADD COLUMN `severity` ENUM('INFO', 'WARN', 'ERROR', 'SECURITY') NOT NULL DEFAULT 'INFO',
  ADD COLUMN `requestId` VARCHAR(191) NULL,
  ADD COLUMN `ipAddress` VARCHAR(191) NULL,
  ADD COLUMN `userAgent` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_severity_idx` ON `AuditLog`(`severity`);
CREATE INDEX `AuditLog_requestId_idx` ON `AuditLog`(`requestId`);

-- CreateTable
CREATE TABLE `ResourceLibraryItem` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `url` VARCHAR(191) NOT NULL,
    `itemType` ENUM('ARTICLE', 'VIDEO', 'DOCUMENT', 'LINK') NOT NULL DEFAULT 'LINK',
    `companyId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `updatedByUserId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResourceLibraryItem_companyId_isActive_idx`(`companyId`, `isActive`),
    INDEX `ResourceLibraryItem_itemType_idx`(`itemType`),
    INDEX `ResourceLibraryItem_createdByUserId_idx`(`createdByUserId`),
    INDEX `ResourceLibraryItem_updatedByUserId_idx`(`updatedByUserId`),
    INDEX `ResourceLibraryItem_title_idx`(`title`),
    INDEX `ResourceLibraryItem_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportConfig` (
    `id` VARCHAR(191) NOT NULL,
    `scopeType` ENUM('GLOBAL', 'COMPANY') NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `whatsappLink` VARCHAR(191) NULL,
    `supportEmail` VARCHAR(191) NULL,
    `helpCenterUrl` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NULL,
    `updatedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SupportConfig_scopeKey_key`(`scopeKey`),
    INDEX `SupportConfig_scopeType_idx`(`scopeType`),
    INDEX `SupportConfig_companyId_idx`(`companyId`),
    INDEX `SupportConfig_enabled_idx`(`enabled`),
    INDEX `SupportConfig_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ResourceLibraryItem`
  ADD CONSTRAINT `ResourceLibraryItem_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ResourceLibraryItem`
  ADD CONSTRAINT `ResourceLibraryItem_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ResourceLibraryItem`
  ADD CONSTRAINT `ResourceLibraryItem_updatedByUserId_fkey`
  FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SupportConfig`
  ADD CONSTRAINT `SupportConfig_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SupportConfig`
  ADD CONSTRAINT `SupportConfig_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SupportConfig`
  ADD CONSTRAINT `SupportConfig_updatedByUserId_fkey`
  FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
