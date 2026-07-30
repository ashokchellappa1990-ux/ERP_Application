-- Coupon Campaign & Promotion Management: 14 tables.

-- CreateTable
CREATE TABLE `coupon_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `enableModule` BOOLEAN NOT NULL DEFAULT true,
    `enableGeneric` BOOLEAN NOT NULL DEFAULT true,
    `enableUnique` BOOLEAN NOT NULL DEFAULT true,
    `enableQr` BOOLEAN NOT NULL DEFAULT true,
    `enableBarcode` BOOLEAN NOT NULL DEFAULT true,
    `enableCustomerMapping` BOOLEAN NOT NULL DEFAULT true,
    `customerMapping` VARCHAR(12) NOT NULL DEFAULT 'Optional',
    `enableMultiPerInvoice` BOOLEAN NOT NULL DEFAULT false,
    `allowWithLoyalty` BOOLEAN NOT NULL DEFAULT false,
    `allowWithMembership` BOOLEAN NOT NULL DEFAULT false,
    `allowWithPromo` BOOLEAN NOT NULL DEFAULT false,
    `allowWithManual` BOOLEAN NOT NULL DEFAULT false,
    `allowReturnRestore` BOOLEAN NOT NULL DEFAULT true,
    `allowCancelRestore` BOOLEAN NOT NULL DEFAULT true,
    `enableApproval` BOOLEAN NOT NULL DEFAULT false,
    `enablePrinting` BOOLEAN NOT NULL DEFAULT true,
    `enableDesigner` BOOLEAN NOT NULL DEFAULT true,
    `enableBatchGen` BOOLEAN NOT NULL DEFAULT true,
    `couponPrefix` VARCHAR(20) NOT NULL DEFAULT 'CPN',
    `couponLength` INTEGER NOT NULL DEFAULT 10,
    `runningNumber` INTEGER NOT NULL DEFAULT 0,
    `seqPeriod` VARCHAR(20) NULL,
    `qrSize` INTEGER NOT NULL DEFAULT 120,
    `barcodeType` VARCHAR(20) NOT NULL DEFAULT 'CODE128',
    `defaultStatus` VARCHAR(12) NOT NULL DEFAULT 'Generated',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coupon_configuration_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_campaign` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `campaignType` VARCHAR(30) NOT NULL DEFAULT 'Promotion',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `couponType` VARCHAR(10) NOT NULL DEFAULT 'Unique',
    `status` VARCHAR(12) NOT NULL DEFAULT 'Draft',
    `startDate` VARCHAR(20) NULL,
    `endDate` VARCHAR(20) NULL,
    `marketingBudget` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` VARCHAR(500) NULL,
    `createdBy` INTEGER NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `coupon_campaign_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_rule_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `campaignId` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `discountType` VARCHAR(20) NOT NULL DEFAULT 'Percentage',
    `discountValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `maxDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `minDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `minBill` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `maxBill` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `minQty` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `maxQty` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `minProductCount` INTEGER NOT NULL DEFAULT 0,
    `maxProductCount` INTEGER NOT NULL DEFAULT 0,
    `buyProductId` INTEGER NULL,
    `buyQty` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `getProductId` INTEGER NULL,
    `getQty` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `sameProduct` BOOLEAN NOT NULL DEFAULT false,
    `gstRule` VARCHAR(12) NOT NULL DEFAULT 'AfterGST',
    `reduceTaxable` BOOLEAN NOT NULL DEFAULT true,
    `salesDiscountCode` VARCHAR(20) NULL,
    `marketingExpenseCode` VARCHAR(20) NULL,
    `costCenter` VARCHAR(80) NULL,
    `department` VARCHAR(80) NULL,
    `project` VARCHAR(80) NULL,
    `maxPerCustomer` INTEGER NOT NULL DEFAULT 0,
    `maxPerInvoice` INTEGER NOT NULL DEFAULT 1,
    `maxPerDay` INTEGER NOT NULL DEFAULT 0,
    `maxPerCampaign` INTEGER NOT NULL DEFAULT 0,
    `usageType` VARCHAR(12) NOT NULL DEFAULT 'SingleUse',
    `startTime` VARCHAR(10) NULL,
    `endTime` VARCHAR(10) NULL,
    `days` VARCHAR(40) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `coupon_rule_master_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_rule_conditions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `ruleId` INTEGER NOT NULL,
    `condType` VARCHAR(24) NOT NULL,
    `operator` VARCHAR(12) NOT NULL DEFAULT 'in',
    `valueJson` TEXT NOT NULL,

    INDEX `coupon_rule_conditions_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_rule_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `ruleId` INTEGER NOT NULL,
    `actionType` VARCHAR(24) NOT NULL,
    `valueJson` TEXT NOT NULL,

    INDEX `coupon_rule_actions_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_template` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(20) NOT NULL DEFAULT 'Generic',
    `layout` LONGTEXT NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `coupon_template_tenantId_category_idx`(`tenantId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_template_objects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `templateId` INTEGER NOT NULL,
    `objectType` VARCHAR(16) NOT NULL,
    `x` INTEGER NOT NULL DEFAULT 0,
    `y` INTEGER NOT NULL DEFAULT 0,
    `w` INTEGER NOT NULL DEFAULT 0,
    `h` INTEGER NOT NULL DEFAULT 0,
    `rotation` INTEGER NOT NULL DEFAULT 0,
    `props` TEXT NULL,

    INDEX `coupon_template_objects_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_generation_batch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `campaignId` INTEGER NOT NULL,
    `batchNo` VARCHAR(40) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `generatedCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Generated',
    `generatedBy` INTEGER NULL,
    `generatedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_generation_batch_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `campaignId` INTEGER NOT NULL,
    `batchId` INTEGER NULL,
    `couponNo` VARCHAR(60) NOT NULL,
    `couponCode` VARCHAR(60) NOT NULL,
    `qrData` VARCHAR(200) NULL,
    `barcodeData` VARCHAR(200) NULL,
    `securityCode` VARCHAR(20) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Generated',
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `redeemedCount` INTEGER NOT NULL DEFAULT 0,
    `printedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `coupon_master_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `coupon_master_campaignId_idx`(`campaignId`),
    UNIQUE INDEX `coupon_master_tenantId_couponNo_key`(`tenantId`, `couponNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_customer_mapping` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `couponId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `customerName` VARCHAR(200) NULL,
    `mappedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_customer_mapping_couponId_idx`(`couponId`),
    INDEX `coupon_customer_mapping_tenantId_customerId_idx`(`tenantId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_issue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `couponId` INTEGER NOT NULL,
    `campaignId` INTEGER NULL,
    `issueTo` VARCHAR(20) NOT NULL,
    `customerId` INTEGER NULL,
    `partyName` VARCHAR(200) NULL,
    `issueDate` VARCHAR(20) NOT NULL,
    `issuedBy` INTEGER NULL,
    `issuedByName` VARCHAR(200) NULL,
    `remarks` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_issue_couponId_idx`(`couponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_redemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `couponId` INTEGER NOT NULL,
    `campaignId` INTEGER NULL,
    `saleId` INTEGER NULL,
    `invoiceNo` VARCHAR(40) NULL,
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `channel` VARCHAR(20) NULL,
    `billAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxableReduced` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `journalRef` VARCHAR(40) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Redeemed',
    `redeemedBy` INTEGER NULL,
    `redeemedByName` VARCHAR(200) NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_redemption_couponId_idx`(`couponId`),
    INDEX `coupon_redemption_tenantId_campaignId_idx`(`tenantId`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_print_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `couponId` INTEGER NULL,
    `batchId` INTEGER NULL,
    `templateId` INTEGER NULL,
    `printType` VARCHAR(12) NOT NULL,
    `format` VARCHAR(12) NOT NULL DEFAULT 'A4',
    `copies` INTEGER NOT NULL DEFAULT 1,
    `perPage` INTEGER NOT NULL DEFAULT 1,
    `printedBy` INTEGER NULL,
    `printedByName` VARCHAR(200) NULL,
    `printedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_print_history_couponId_idx`(`couponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `entityType` VARCHAR(16) NOT NULL,
    `entityId` INTEGER NULL,
    `action` VARCHAR(24) NOT NULL,
    `byUser` INTEGER NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_audit_tenantId_entityType_idx`(`tenantId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `coupon_rule_master` ADD CONSTRAINT `coupon_rule_master_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `coupon_campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_rule_conditions` ADD CONSTRAINT `coupon_rule_conditions_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `coupon_rule_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_rule_actions` ADD CONSTRAINT `coupon_rule_actions_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `coupon_rule_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_template_objects` ADD CONSTRAINT `coupon_template_objects_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `coupon_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_generation_batch` ADD CONSTRAINT `coupon_generation_batch_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `coupon_campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_master` ADD CONSTRAINT `coupon_master_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `coupon_campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_master` ADD CONSTRAINT `coupon_master_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `coupon_generation_batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_customer_mapping` ADD CONSTRAINT `coupon_customer_mapping_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupon_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_issue` ADD CONSTRAINT `coupon_issue_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupon_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_redemption` ADD CONSTRAINT `coupon_redemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupon_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_print_history` ADD CONSTRAINT `coupon_print_history_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupon_master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
