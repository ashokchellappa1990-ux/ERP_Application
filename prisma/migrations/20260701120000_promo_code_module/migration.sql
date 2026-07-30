-- Promo Code Management module: 8 promo tables + shared rule-table link
-- (coupon_rule_master.campaignId made nullable, promoCampaignId added).

-- AlterTable
ALTER TABLE `coupon_rule_master` ADD COLUMN `promoCampaignId` INTEGER NULL,
    MODIFY `campaignId` INTEGER NULL;

-- CreateTable
CREATE TABLE `promo_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `enableModule` BOOLEAN NOT NULL DEFAULT true,
    `enableManualCode` BOOLEAN NOT NULL DEFAULT true,
    `enableAutoCode` BOOLEAN NOT NULL DEFAULT true,
    `enableBulkGen` BOOLEAN NOT NULL DEFAULT true,
    `enableCustomerMapping` BOOLEAN NOT NULL DEFAULT true,
    `customerMapping` VARCHAR(12) NOT NULL DEFAULT 'Public',
    `enableApproval` BOOLEAN NOT NULL DEFAULT false,
    `enableAnalytics` BOOLEAN NOT NULL DEFAULT true,
    `enableExpiryNotify` BOOLEAN NOT NULL DEFAULT false,
    `enableUsageNotify` BOOLEAN NOT NULL DEFAULT false,
    `enableMultiPerInvoice` BOOLEAN NOT NULL DEFAULT false,
    `allowWithLoyalty` BOOLEAN NOT NULL DEFAULT true,
    `allowWithMembership` BOOLEAN NOT NULL DEFAULT false,
    `allowWithCoupon` BOOLEAN NOT NULL DEFAULT false,
    `allowWithManual` BOOLEAN NOT NULL DEFAULT false,
    `allowWithGiftVoucher` BOOLEAN NOT NULL DEFAULT false,
    `allowReturnRestore` BOOLEAN NOT NULL DEFAULT true,
    `allowCancelRestore` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `conflictResolution` VARCHAR(20) NOT NULL DEFAULT 'HighestDiscount',
    `codePrefix` VARCHAR(20) NOT NULL DEFAULT 'PROMO',
    `codeLength` INTEGER NOT NULL DEFAULT 10,
    `runningNumber` INTEGER NOT NULL DEFAULT 0,
    `defaultStatus` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `promo_configuration_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_campaign` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `campaignType` VARCHAR(30) NOT NULL DEFAULT 'Digital',
    `marketingBudget` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `campaignOwner` VARCHAR(200) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `startDate` VARCHAR(20) NULL,
    `endDate` VARCHAR(20) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Draft',
    `remarks` VARCHAR(500) NULL,
    `createdBy` INTEGER NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `promo_campaign_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_code_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `campaignId` INTEGER NOT NULL,
    `promoCode` VARCHAR(60) NOT NULL,
    `name` VARCHAR(150) NULL,
    `description` VARCHAR(400) NULL,
    `codeType` VARCHAR(16) NOT NULL DEFAULT 'Public',
    `generationType` VARCHAR(12) NOT NULL DEFAULT 'Auto',
    `prefix` VARCHAR(20) NULL,
    `suffix` VARCHAR(20) NULL,
    `qrData` VARCHAR(200) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `generationBatch` VARCHAR(40) NULL,
    `usageLimit` INTEGER NOT NULL DEFAULT 0,
    `redeemedCount` INTEGER NOT NULL DEFAULT 0,
    `distributedCount` INTEGER NOT NULL DEFAULT 0,
    `createdBy` INTEGER NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `promo_code_master_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `promo_code_master_campaignId_idx`(`campaignId`),
    UNIQUE INDEX `promo_code_master_tenantId_promoCode_key`(`tenantId`, `promoCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_distribution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `campaignId` INTEGER NOT NULL,
    `promoCodeId` INTEGER NULL,
    `distributionDate` VARCHAR(20) NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `recipient` VARCHAR(200) NULL,
    `recipientContact` VARCHAR(200) NULL,
    `customerId` INTEGER NULL,
    `deliveryStatus` VARCHAR(12) NOT NULL DEFAULT 'Sent',
    `remarks` VARCHAR(400) NULL,
    `sentBy` INTEGER NULL,
    `sentByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `promo_distribution_campaignId_idx`(`campaignId`),
    INDEX `promo_distribution_tenantId_channel_idx`(`tenantId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_customer_mapping` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `promoCodeId` INTEGER NOT NULL,
    `mappingType` VARCHAR(16) NOT NULL DEFAULT 'Customer',
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `refValue` VARCHAR(120) NULL,
    `mappedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `promo_customer_mapping_promoCodeId_idx`(`promoCodeId`),
    INDEX `promo_customer_mapping_tenantId_customerId_idx`(`tenantId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_redemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `promoCodeId` INTEGER NOT NULL,
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

    INDEX `promo_redemption_promoCodeId_idx`(`promoCodeId`),
    INDEX `promo_redemption_tenantId_campaignId_idx`(`tenantId`, `campaignId`),
    INDEX `promo_redemption_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_analytics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `campaignId` INTEGER NULL,
    `snapshotDate` VARCHAR(20) NOT NULL,
    `totalCodes` INTEGER NOT NULL DEFAULT 0,
    `activeCodes` INTEGER NOT NULL DEFAULT 0,
    `redeemedCodes` INTEGER NOT NULL DEFAULT 0,
    `expiredCodes` INTEGER NOT NULL DEFAULT 0,
    `distributedCount` INTEGER NOT NULL DEFAULT 0,
    `totalDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `redemptionRate` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `roi` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `promo_analytics_tenantId_campaignId_idx`(`tenantId`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_audit` (
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

    INDEX `promo_audit_tenantId_entityType_idx`(`tenantId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `coupon_rule_master_promoCampaignId_idx` ON `coupon_rule_master`(`promoCampaignId`);

-- AddForeignKey
ALTER TABLE `coupon_rule_master` ADD CONSTRAINT `coupon_rule_master_promoCampaignId_fkey` FOREIGN KEY (`promoCampaignId`) REFERENCES `promo_campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_code_master` ADD CONSTRAINT `promo_code_master_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `promo_campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_distribution` ADD CONSTRAINT `promo_distribution_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `promo_campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_distribution` ADD CONSTRAINT `promo_distribution_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `promo_code_master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_customer_mapping` ADD CONSTRAINT `promo_customer_mapping_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `promo_code_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_redemption` ADD CONSTRAINT `promo_redemption_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `promo_code_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_redemption` ADD CONSTRAINT `promo_redemption_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `promo_campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
