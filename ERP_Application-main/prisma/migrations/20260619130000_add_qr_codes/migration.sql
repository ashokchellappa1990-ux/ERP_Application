-- AlterTable: QR fields on opening stock lines
ALTER TABLE `opening_stock_lines`
  ADD COLUMN `qrMode` VARCHAR(10) NOT NULL DEFAULT 'shared',
  ADD COLUMN `qrStatus` VARCHAR(20) NOT NULL DEFAULT 'Pending',
  ADD COLUMN `qrGeneratedCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `printedQty` INTEGER NOT NULL DEFAULT 0;

-- CreateTable: QR reference mappings
CREATE TABLE `qr_code_mappings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(80) NOT NULL,
  `lineId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `seq` INTEGER NOT NULL DEFAULT 1,
  `mode` VARCHAR(10) NOT NULL,
  `printed` BOOLEAN NOT NULL DEFAULT false,
  `printedCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `qr_code_mappings_code_key`(`code`),
  INDEX `qr_code_mappings_lineId_idx`(`lineId`),
  INDEX `qr_code_mappings_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `qr_code_mappings` ADD CONSTRAINT `qr_code_mappings_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `opening_stock_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: QR settings (single row)
CREATE TABLE `qr_code_settings` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `prefix` VARCHAR(20) NOT NULL DEFAULT 'QR',
  `separator` VARCHAR(3) NOT NULL DEFAULT '-',
  `includeDocRef` BOOLEAN NOT NULL DEFAULT true,
  `includeProductCode` BOOLEAN NOT NULL DEFAULT true,
  `includeSequence` BOOLEAN NOT NULL DEFAULT true,
  `sequenceLength` INTEGER NOT NULL DEFAULT 4,
  `nextSequence` INTEGER NOT NULL DEFAULT 1,
  `errorCorrection` VARCHAR(1) NOT NULL DEFAULT 'M',
  `darkColor` VARCHAR(9) NOT NULL DEFAULT '#0f172a',
  `lightColor` VARCHAR(9) NOT NULL DEFAULT '#ffffff',
  `moduleStyle` VARCHAR(10) NOT NULL DEFAULT 'square',
  `labelWidthMm` INTEGER NOT NULL DEFAULT 50,
  `labelHeightMm` INTEGER NOT NULL DEFAULT 30,
  `showName` BOOLEAN NOT NULL DEFAULT true,
  `showPrice` BOOLEAN NOT NULL DEFAULT true,
  `showCodeText` BOOLEAN NOT NULL DEFAULT true,
  `defaultMode` VARCHAR(10) NOT NULL DEFAULT 'shared',
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the single settings row
INSERT INTO `qr_code_settings` (`id`, `updatedAt`) VALUES (1, CURRENT_TIMESTAMP(3));
