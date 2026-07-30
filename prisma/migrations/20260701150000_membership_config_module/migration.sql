-- Membership Configuration module: 15 tables.

-- CreateTable
CREATE TABLE `membership_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `enableModule` BOOLEAN NOT NULL DEFAULT true,
    `membershipType` VARCHAR(20) NOT NULL DEFAULT 'Paid',
    `numberGeneration` VARCHAR(8) NOT NULL DEFAULT 'Auto',
    `numberPrefix` VARCHAR(20) NOT NULL DEFAULT 'MEM',
    `numberLength` INTEGER NOT NULL DEFAULT 10,
    `runningNumber` INTEGER NOT NULL DEFAULT 0,
    `defaultStatus` VARCHAR(12) NOT NULL DEFAULT 'Draft',
    `allowMultiple` BOOLEAN NOT NULL DEFAULT false,
    `allowTransfer` BOOLEAN NOT NULL DEFAULT false,
    `autoActivate` BOOLEAN NOT NULL DEFAULT false,
    `requireApproval` BOOLEAN NOT NULL DEFAULT true,
    `enableExpiry` BOOLEAN NOT NULL DEFAULT true,
    `enableAutoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `enableAutoUpgrade` BOOLEAN NOT NULL DEFAULT false,
    `enableAutoDowngrade` BOOLEAN NOT NULL DEFAULT false,
    `renewalReminderDays` INTEGER NOT NULL DEFAULT 15,
    `expiryReminderDays` INTEGER NOT NULL DEFAULT 7,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_configuration_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_level_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(400) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `themeColor` VARCHAR(20) NULL,
    `icon` VARCHAR(40) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `createdBy` INTEGER NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `membership_level_master_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_qualification_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `method` VARCHAR(24) NOT NULL,
    `evaluationPeriod` VARCHAR(12) NOT NULL DEFAULT 'Yearly',
    `minPurchase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `minBills` INTEGER NOT NULL DEFAULT 0,
    `minPoints` INTEGER NOT NULL DEFAULT 0,
    `minFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `minFrequency` INTEGER NOT NULL DEFAULT 0,
    `referralCount` INTEGER NOT NULL DEFAULT 0,
    `customerType` VARCHAR(40) NULL,
    `campaignRef` VARCHAR(80) NULL,
    `combineLogic` VARCHAR(4) NOT NULL DEFAULT 'OR',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_qualification_rule_levelId_idx`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_benefit_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `billDiscountPct` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `maxDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `productDiscountPct` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `categoryDiscountPct` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `brandDiscountPct` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `maxDiscountPerBill` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `maxDiscountPerDay` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `maxDiscountPerMonth` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `pointMultiplier` DECIMAL(9, 2) NOT NULL DEFAULT 1,
    `welcomePoints` INTEGER NOT NULL DEFAULT 0,
    `birthdayPoints` INTEGER NOT NULL DEFAULT 0,
    `anniversaryPoints` INTEGER NOT NULL DEFAULT 0,
    `bonusPoints` INTEGER NOT NULL DEFAULT 0,
    `exclusivePromo` BOOLEAN NOT NULL DEFAULT false,
    `campaignEligible` BOOLEAN NOT NULL DEFAULT false,
    `couponBenefits` TEXT NULL,
    `voucherBenefits` TEXT NULL,
    `serviceBenefits` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_benefit_master_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_fee_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `registrationFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `renewalFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `securityDeposit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refundable` BOOLEAN NOT NULL DEFAULT false,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `gstApplicable` BOOLEAN NOT NULL DEFAULT false,
    `gstPercentage` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `discountOnRenewal` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `lateRenewalCharge` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_fee_configuration_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_validity_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `validityType` VARCHAR(12) NOT NULL DEFAULT 'Yearly',
    `validityDays` INTEGER NOT NULL DEFAULT 365,
    `effectiveFrom` VARCHAR(20) NULL,
    `effectiveTo` VARCHAR(20) NULL,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_validity_configuration_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_upgrade_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `autoUpgrade` BOOLEAN NOT NULL DEFAULT false,
    `manualUpgrade` BOOLEAN NOT NULL DEFAULT true,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `upgradeBasedOn` TEXT NULL,
    `minPurchase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `minBills` INTEGER NOT NULL DEFAULT 0,
    `minPoints` INTEGER NOT NULL DEFAULT 0,
    `minFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `evaluationPeriod` VARCHAR(12) NOT NULL DEFAULT 'Yearly',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_upgrade_rule_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_downgrade_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `autoDowngrade` BOOLEAN NOT NULL DEFAULT false,
    `manualDowngrade` BOOLEAN NOT NULL DEFAULT true,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 30,
    `purchaseThreshold` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `billThreshold` INTEGER NOT NULL DEFAULT 0,
    `pointThreshold` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_downgrade_rule_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_renewal_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `autoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `manualRenewal` BOOLEAN NOT NULL DEFAULT true,
    `renewalFee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `renewalValidityDays` INTEGER NOT NULL DEFAULT 365,
    `renewalReminderDays` INTEGER NOT NULL DEFAULT 15,
    `renewalBonusPoints` INTEGER NOT NULL DEFAULT 0,
    `renewalCoupon` BOOLEAN NOT NULL DEFAULT false,
    `renewalGiftVoucher` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_renewal_configuration_tenantId_businessId_branchI_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_customer_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `fieldsJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_customer_configuration_tenantId_businessId_branch_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_finance_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `registrationFeeAccount` VARCHAR(20) NULL,
    `renewalFeeAccount` VARCHAR(20) NULL,
    `discountAccount` VARCHAR(20) NULL,
    `refundAccount` VARCHAR(20) NULL,
    `marketingExpenseAccount` VARCHAR(20) NULL,
    `costCenter` VARCHAR(80) NULL,
    `department` VARCHAR(80) NULL,
    `project` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_finance_configuration_tenantId_businessId_branchI_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_notification_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `eventsJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_notification_configuration_tenantId_businessId_br_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_card_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `enableCard` BOOLEAN NOT NULL DEFAULT true,
    `cardType` VARCHAR(10) NOT NULL DEFAULT 'Both',
    `generateQr` BOOLEAN NOT NULL DEFAULT true,
    `generateBarcode` BOOLEAN NOT NULL DEFAULT false,
    `showCardNumber` BOOLEAN NOT NULL DEFAULT true,
    `showLogo` BOOLEAN NOT NULL DEFAULT true,
    `showPhoto` BOOLEAN NOT NULL DEFAULT true,
    `showLevel` BOOLEAN NOT NULL DEFAULT true,
    `showIssueDate` BOOLEAN NOT NULL DEFAULT true,
    `showExpiryDate` BOOLEAN NOT NULL DEFAULT true,
    `showSignature` BOOLEAN NOT NULL DEFAULT false,
    `theme` VARCHAR(40) NOT NULL DEFAULT 'Default',
    `cardSize` VARCHAR(20) NOT NULL DEFAULT 'CR80',
    `allowReprint` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_card_configuration_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_approval_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `approvalLevels` INTEGER NOT NULL DEFAULT 1,
    `approvalRolesJson` TEXT NULL,
    `approvalNotifications` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_approval_configuration_tenantId_businessId_branch_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `entityType` VARCHAR(20) NOT NULL,
    `entityId` INTEGER NULL,
    `action` VARCHAR(28) NOT NULL,
    `byUser` INTEGER NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_audit_tenantId_entityType_idx`(`tenantId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `membership_qualification_rule` ADD CONSTRAINT `membership_qualification_rule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `membership_level_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_benefit_master` ADD CONSTRAINT `membership_benefit_master_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `membership_level_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_fee_configuration` ADD CONSTRAINT `membership_fee_configuration_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `membership_level_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_validity_configuration` ADD CONSTRAINT `membership_validity_configuration_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `membership_level_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_upgrade_rule` ADD CONSTRAINT `membership_upgrade_rule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `membership_level_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_downgrade_rule` ADD CONSTRAINT `membership_downgrade_rule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `membership_level_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
