-- Customer 360: customer notes / logged communications.
CREATE TABLE `customer_notes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `customerId` INTEGER NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'Note',
  `subject` VARCHAR(200) NULL,
  `body` VARCHAR(2000) NOT NULL,
  `createdBy` INTEGER NULL,
  `createdByName` VARCHAR(160) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `customer_notes_tenantId_customerId_idx`(`tenantId`, `customerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
