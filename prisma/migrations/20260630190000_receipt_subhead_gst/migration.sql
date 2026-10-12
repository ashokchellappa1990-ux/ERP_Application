-- Receipt module: sub receipt heads + GST capture.

CREATE TABLE `receipt_sub_head` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `categoryId` INTEGER NOT NULL,
  `code` VARCHAR(30) NULL,
  `name` VARCHAR(120) NOT NULL,
  `creditCode` VARCHAR(20) NULL,
  `creditName` VARCHAR(120) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `receipt_sub_head_categoryId_idx`(`categoryId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `receipt_sub_head` ADD CONSTRAINT `receipt_sub_head_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `receipt_category_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `receipt_configuration`
  ADD COLUMN `enableSubHead` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `enableGst` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `receipt_transaction`
  ADD COLUMN `taxableAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `gstApplicable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `gstAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `partyGstin` VARCHAR(20) NULL;

-- Re-shape the (empty) details table from payment-mode lines to sub-head lines.
ALTER TABLE `receipt_transaction_details`
  DROP COLUMN `mode`,
  DROP COLUMN `accountCode`,
  DROP COLUMN `accountName`,
  DROP COLUMN `bankName`,
  DROP COLUMN `referenceNo`,
  DROP COLUMN `referenceDate`,
  ADD COLUMN `subHeadId` INTEGER NULL,
  ADD COLUMN `headName` VARCHAR(120) NULL,
  ADD COLUMN `taxable` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `gstRate` DECIMAL(9,2) NULL,
  ADD COLUMN `gstAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `creditCode` VARCHAR(20) NULL,
  ADD COLUMN `creditName` VARCHAR(120) NULL;
