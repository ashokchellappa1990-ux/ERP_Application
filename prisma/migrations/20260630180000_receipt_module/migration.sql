-- Receipt Transaction module (miscellaneous, non-sales receipts).

CREATE TABLE `receipt_configuration` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `enableModule` BOOLEAN NOT NULL DEFAULT true,
  `enableApproval` BOOLEAN NOT NULL DEFAULT false,
  `enableAttachment` BOOLEAN NOT NULL DEFAULT true,
  `enableCostCenter` BOOLEAN NOT NULL DEFAULT false,
  `enableDepartment` BOOLEAN NOT NULL DEFAULT false,
  `enableProject` BOOLEAN NOT NULL DEFAULT false,
  `enableMultiMode` BOOLEAN NOT NULL DEFAULT false,
  `autoVoucher` BOOLEAN NOT NULL DEFAULT true,
  `voucherPrefix` VARCHAR(20) NOT NULL DEFAULT 'REC',
  `voucherPadding` INTEGER NOT NULL DEFAULT 4,
  `voucherSeparator` VARCHAR(4) NOT NULL DEFAULT '/',
  `voucherReset` VARCHAR(10) NOT NULL DEFAULT 'Yearly',
  `voucherSeq` INTEGER NOT NULL DEFAULT 0,
  `voucherSeqPeriod` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `receipt_configuration_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `receipt_category_master` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(300) NULL,
  `debitCode` VARCHAR(20) NULL,
  `debitName` VARCHAR(120) NULL,
  `creditCode` VARCHAR(20) NULL,
  `creditName` VARCHAR(120) NULL,
  `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
  `allowAttachment` BOOLEAN NOT NULL DEFAULT true,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `receipt_category_master_tenantId_active_idx`(`tenantId`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `receipt_transaction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `voucherNo` VARCHAR(40) NOT NULL,
  `voucherDate` VARCHAR(20) NOT NULL,
  `financialYear` VARCHAR(20) NULL,
  `accountingPeriod` VARCHAR(20) NULL,
  `categoryId` INTEGER NULL,
  `categoryCode` VARCHAR(30) NULL,
  `categoryName` VARCHAR(120) NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `mode` VARCHAR(20) NOT NULL,
  `cashAccountCode` VARCHAR(20) NULL,
  `bankAccountCode` VARCHAR(20) NULL,
  `bankName` VARCHAR(120) NULL,
  `partyType` VARCHAR(20) NULL,
  `partyId` INTEGER NULL,
  `partyName` VARCHAR(200) NULL,
  `referenceNo` VARCHAR(80) NULL,
  `referenceDate` VARCHAR(20) NULL,
  `narration` VARCHAR(400) NULL,
  `debitCode` VARCHAR(20) NULL,
  `debitName` VARCHAR(120) NULL,
  `creditCode` VARCHAR(20) NULL,
  `creditName` VARCHAR(120) NULL,
  `costCenter` VARCHAR(80) NULL,
  `department` VARCHAR(80) NULL,
  `project` VARCHAR(80) NULL,
  `remarks` VARCHAR(400) NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'Draft',
  `journalRef` VARCHAR(40) NULL,
  `submittedBy` INTEGER NULL,
  `submittedByName` VARCHAR(200) NULL,
  `submittedAt` DATETIME(3) NULL,
  `approvedBy` INTEGER NULL,
  `approvedByName` VARCHAR(200) NULL,
  `approvedAt` DATETIME(3) NULL,
  `postedBy` INTEGER NULL,
  `postedByName` VARCHAR(200) NULL,
  `postedAt` DATETIME(3) NULL,
  `cancelledBy` INTEGER NULL,
  `cancelledByName` VARCHAR(200) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdBy` INTEGER NULL,
  `createdByName` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `receipt_transaction_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `receipt_transaction_tenantId_voucherDate_idx`(`tenantId`, `voucherDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `receipt_transaction_details` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `receiptId` INTEGER NOT NULL,
  `mode` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `accountCode` VARCHAR(20) NULL,
  `accountName` VARCHAR(120) NULL,
  `bankName` VARCHAR(120) NULL,
  `referenceNo` VARCHAR(80) NULL,
  `referenceDate` VARCHAR(20) NULL,
  INDEX `receipt_transaction_details_receiptId_idx`(`receiptId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `receipt_transaction_details` ADD CONSTRAINT `receipt_transaction_details_receiptId_fkey`
  FOREIGN KEY (`receiptId`) REFERENCES `receipt_transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `receipt_attachment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `receiptId` INTEGER NOT NULL,
  `docType` VARCHAR(20) NOT NULL DEFAULT 'supporting',
  `fileName` VARCHAR(200) NOT NULL,
  `fileUrl` LONGTEXT NOT NULL,
  `fileType` VARCHAR(80) NULL,
  `size` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `receipt_attachment_receiptId_idx`(`receiptId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `receipt_attachment` ADD CONSTRAINT `receipt_attachment_receiptId_fkey`
  FOREIGN KEY (`receiptId`) REFERENCES `receipt_transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `receipt_audit` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `receiptId` INTEGER NOT NULL,
  `action` VARCHAR(20) NOT NULL,
  `byUser` INTEGER NULL,
  `byName` VARCHAR(200) NULL,
  `note` VARCHAR(300) NULL,
  `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `receipt_audit_receiptId_idx`(`receiptId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `receipt_audit` ADD CONSTRAINT `receipt_audit_receiptId_fkey`
  FOREIGN KEY (`receiptId`) REFERENCES `receipt_transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
