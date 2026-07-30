-- Gift Voucher Management module: 12 tables.

-- CreateTable
CREATE TABLE `gift_voucher_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `enableModule` BOOLEAN NOT NULL DEFAULT true,
    `enableQr` BOOLEAN NOT NULL DEFAULT true,
    `enableBarcode` BOOLEAN NOT NULL DEFAULT false,
    `enableCustomerMapping` BOOLEAN NOT NULL DEFAULT true,
    `customerMapping` VARCHAR(12) NOT NULL DEFAULT 'Optional',
    `enablePartialRedemption` BOOLEAN NOT NULL DEFAULT true,
    `enableMultipleRedemption` BOOLEAN NOT NULL DEFAULT true,
    `enableTransfer` BOOLEAN NOT NULL DEFAULT false,
    `enableRevalidation` BOOLEAN NOT NULL DEFAULT true,
    `enableExpiry` BOOLEAN NOT NULL DEFAULT true,
    `enableAutoExpiry` BOOLEAN NOT NULL DEFAULT true,
    `enableReissue` BOOLEAN NOT NULL DEFAULT true,
    `enableReplacement` BOOLEAN NOT NULL DEFAULT true,
    `autoActivateOnSale` BOOLEAN NOT NULL DEFAULT true,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `gstOnSale` BOOLEAN NOT NULL DEFAULT false,
    `gstPercentage` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `numberPrefix` VARCHAR(20) NOT NULL DEFAULT 'GV',
    `numberLength` INTEGER NOT NULL DEFAULT 12,
    `runningNumber` INTEGER NOT NULL DEFAULT 0,
    `securityLength` INTEGER NOT NULL DEFAULT 6,
    `defaultValidityDays` INTEGER NOT NULL DEFAULT 365,
    `liabilityAccount` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gift_voucher_configuration_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_template` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(24) NOT NULL DEFAULT 'Generic',
    `layout` LONGTEXT NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_generation_batch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `batchNo` VARCHAR(40) NOT NULL,
    `voucherType` VARCHAR(24) NOT NULL,
    `faceValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `generatedCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Generated',
    `generatedBy` INTEGER NULL,
    `generatedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_generation_batch_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `batchId` INTEGER NULL,
    `voucherNo` VARCHAR(60) NOT NULL,
    `voucherType` VARCHAR(24) NOT NULL DEFAULT 'FixedValue',
    `faceValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `originalValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `redeemedValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `availableBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `securityCode` VARCHAR(20) NULL,
    `qrData` VARCHAR(200) NULL,
    `barcodeData` VARCHAR(200) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Generated',
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `issueDate` VARCHAR(20) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `activatedAt` VARCHAR(20) NULL,
    `lastRedemptionDate` VARCHAR(20) NULL,
    `lastRedemptionBranchId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `gift_voucher_master_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `gift_voucher_master_customerId_idx`(`customerId`),
    UNIQUE INDEX `gift_voucher_master_tenantId_voucherNo_key`(`tenantId`, `voucherNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_sale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `voucherId` INTEGER NOT NULL,
    `saleNo` VARCHAR(40) NOT NULL,
    `saleDate` VARCHAR(20) NOT NULL,
    `buyerType` VARCHAR(20) NOT NULL DEFAULT 'WalkIn',
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `faceValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `salePrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `paymentMode` VARCHAR(20) NOT NULL,
    `paymentRef` VARCHAR(80) NULL,
    `invoiceNo` VARCHAR(40) NULL,
    `salespersonId` INTEGER NULL,
    `journalRef` VARCHAR(40) NULL,
    `remarks` VARCHAR(400) NULL,
    `createdBy` INTEGER NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_sale_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_activation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `voucherId` INTEGER NOT NULL,
    `activationDate` VARCHAR(20) NOT NULL,
    `method` VARCHAR(12) NOT NULL DEFAULT 'Manual',
    `activatedBy` INTEGER NULL,
    `activatedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_activation_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_balance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `voucherId` INTEGER NOT NULL,
    `adjType` VARCHAR(12) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `balanceAfter` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `reason` VARCHAR(400) NULL,
    `toVoucherId` INTEGER NULL,
    `approvedBy` INTEGER NULL,
    `approvedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_balance_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_redemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `voucherId` INTEGER NOT NULL,
    `redemptionNo` VARCHAR(40) NOT NULL,
    `redemptionDate` VARCHAR(20) NOT NULL,
    `saleId` INTEGER NULL,
    `invoiceNo` VARCHAR(40) NULL,
    `customerId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `balanceBefore` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `balanceAfter` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `journalRef` VARCHAR(40) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Redeemed',
    `redeemedBy` INTEGER NULL,
    `redeemedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_redemption_voucherId_idx`(`voucherId`),
    INDEX `gift_voucher_redemption_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `voucherId` INTEGER NOT NULL,
    `txnType` VARCHAR(12) NOT NULL,
    `direction` VARCHAR(3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `balanceAfter` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refNo` VARCHAR(40) NULL,
    `txnDate` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_ledger_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `voucherId` INTEGER NOT NULL,
    `fromStatus` VARCHAR(12) NULL,
    `toStatus` VARCHAR(12) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `byUser` INTEGER NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_history_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_closure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `voucherId` INTEGER NOT NULL,
    `closureDate` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(40) NOT NULL,
    `note` VARCHAR(400) NULL,
    `closedBy` INTEGER NULL,
    `closedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_closure_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_voucher_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `entityType` VARCHAR(16) NOT NULL,
    `entityId` INTEGER NULL,
    `action` VARCHAR(28) NOT NULL,
    `byUser` INTEGER NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_voucher_audit_tenantId_entityType_idx`(`tenantId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gift_voucher_master` ADD CONSTRAINT `gift_voucher_master_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `gift_voucher_generation_batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_sale` ADD CONSTRAINT `gift_voucher_sale_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_activation` ADD CONSTRAINT `gift_voucher_activation_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_balance` ADD CONSTRAINT `gift_voucher_balance_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_redemption` ADD CONSTRAINT `gift_voucher_redemption_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_ledger` ADD CONSTRAINT `gift_voucher_ledger_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_history` ADD CONSTRAINT `gift_voucher_history_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_voucher_closure` ADD CONSTRAINT `gift_voucher_closure_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `gift_voucher_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
