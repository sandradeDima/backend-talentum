-- CreateTable
CREATE TABLE `CoolturaConfig` (
    `id` VARCHAR(191) NOT NULL,
    `linkedinUrl` VARCHAR(191) NULL,
    `youtubeUrl` VARCHAR(191) NULL,
    `instagramUrl` VARCHAR(191) NULL,
    `facebookUrl` VARCHAR(191) NULL,
    `tiktokUrl` VARCHAR(191) NULL,
    `whatsappLink` VARCHAR(191) NULL,
    `boliviaDireccion` VARCHAR(191) NULL,
    `boliviaTelefono` VARCHAR(191) NULL,
    `boliviaEmail` VARCHAR(191) NULL,
    `paraguayDireccion` VARCHAR(191) NULL,
    `paraguayTelefono` VARCHAR(191) NULL,
    `paraguayEmail` VARCHAR(191) NULL,
    `updatedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoolturaConfig` ADD CONSTRAINT `CoolturaConfig_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
