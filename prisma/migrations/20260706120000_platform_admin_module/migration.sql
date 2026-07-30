-- Platform Administration Portal: 19 tables + tenants platform columns.

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `businessAdminEmail` VARCHAR(150) NULL,
    ADD COLUMN `businessAdminPhone` VARCHAR(20) NULL,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `platformStatus` VARCHAR(16) NOT NULL DEFAULT 'Active';

-- CreateTable
CREATE TABLE `platform_role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(300) NULL,
    `permissions` TEXT NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_role_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `platformRoleId` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_session` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(128) NOT NULL,
    `platformUserId` INTEGER NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(300) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_session_token_key`(`token`),
    INDEX `platform_session_platformUserId_idx`(`platformUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `tier` VARCHAR(20) NOT NULL DEFAULT 'Standard',
    `monthlyPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `quarterlyPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `halfYearlyPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `yearlyPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `lifetimePrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `maxUsers` INTEGER NOT NULL DEFAULT 5,
    `maxCompanies` INTEGER NOT NULL DEFAULT 1,
    `maxBranches` INTEGER NOT NULL DEFAULT 1,
    `maxWarehouses` INTEGER NOT NULL DEFAULT 1,
    `maxProducts` INTEGER NOT NULL DEFAULT 1000,
    `maxCustomers` INTEGER NOT NULL DEFAULT 1000,
    `maxSuppliers` INTEGER NOT NULL DEFAULT 500,
    `maxStorageMb` INTEGER NOT NULL DEFAULT 1024,
    `maxApiCalls` INTEGER NOT NULL DEFAULT 10000,
    `maxAiCredits` INTEGER NOT NULL DEFAULT 100,
    `maxTransactions` INTEGER NOT NULL DEFAULT 10000,
    `modules` TEXT NULL,
    `features` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `isCustom` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trial_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `durationDays` INTEGER NOT NULL DEFAULT 15,
    `maxUsers` INTEGER NOT NULL DEFAULT 3,
    `maxBranches` INTEGER NOT NULL DEFAULT 1,
    `maxWarehouses` INTEGER NOT NULL DEFAULT 1,
    `maxProducts` INTEGER NOT NULL DEFAULT 500,
    `maxCustomers` INTEGER NOT NULL DEFAULT 500,
    `maxSuppliers` INTEGER NOT NULL DEFAULT 200,
    `maxStorageMb` INTEGER NOT NULL DEFAULT 512,
    `maxTransactions` INTEGER NOT NULL DEFAULT 2000,
    `maxAiCredits` INTEGER NOT NULL DEFAULT 50,
    `maxApiCalls` INTEGER NOT NULL DEFAULT 5000,
    `modules` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_workspace` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` VARCHAR(16) NOT NULL DEFAULT 'Production',
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `isProduction` BOOLEAN NOT NULL DEFAULT false,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tenant_workspace_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_workspace_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspaceId` INTEGER NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `fromStatus` VARCHAR(12) NULL,
    `toStatus` VARCHAR(12) NOT NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_workspace_history_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `billingCycle` VARCHAR(12) NOT NULL DEFAULT 'Monthly',
    `startDate` VARCHAR(20) NOT NULL,
    `endDate` VARCHAR(20) NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
    `autoRenew` BOOLEAN NOT NULL DEFAULT true,
    `activatedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tenant_subscription_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_subscription_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `fromPlan` VARCHAR(120) NULL,
    `toPlan` VARCHAR(120) NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_subscription_history_subscriptionId_idx`(`subscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_conversion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `conversionType` VARCHAR(20) NOT NULL,
    `fromWorkspaceId` INTEGER NULL,
    `toWorkspaceId` INTEGER NULL,
    `planId` INTEGER NULL,
    `keepScope` TEXT NULL,
    `clearScope` TEXT NULL,
    `byName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_conversion_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_archive` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `workspaceId` INTEGER NULL,
    `archiveDate` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `sizeMb` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(12) NOT NULL DEFAULT 'ReadOnly',
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_archive_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `license_configuration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `maxUsers` INTEGER NOT NULL DEFAULT 5,
    `maxCompanies` INTEGER NOT NULL DEFAULT 1,
    `maxBranches` INTEGER NOT NULL DEFAULT 1,
    `maxWarehouses` INTEGER NOT NULL DEFAULT 1,
    `maxProducts` INTEGER NOT NULL DEFAULT 1000,
    `maxCustomers` INTEGER NOT NULL DEFAULT 1000,
    `maxSuppliers` INTEGER NOT NULL DEFAULT 500,
    `maxStorageMb` INTEGER NOT NULL DEFAULT 1024,
    `maxApiCalls` INTEGER NOT NULL DEFAULT 10000,
    `maxAiCredits` INTEGER NOT NULL DEFAULT 100,
    `maxTransactions` INTEGER NOT NULL DEFAULT 10000,
    `aiEnabled` BOOLEAN NOT NULL DEFAULT false,
    `analyticsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `manufacturingEnabled` BOOLEAN NOT NULL DEFAULT false,
    `financeEnabled` BOOLEAN NOT NULL DEFAULT true,
    `crmEnabled` BOOLEAN NOT NULL DEFAULT true,
    `hrmsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `loyaltyEnabled` BOOLEAN NOT NULL DEFAULT false,
    `membershipEnabled` BOOLEAN NOT NULL DEFAULT false,
    `couponEnabled` BOOLEAN NOT NULL DEFAULT false,
    `promoEnabled` BOOLEAN NOT NULL DEFAULT false,
    `giftVoucherEnabled` BOOLEAN NOT NULL DEFAULT false,
    `validFrom` VARCHAR(20) NULL,
    `validTo` VARCHAR(20) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `license_configuration_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `license_assignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `licenseConfigId` INTEGER NOT NULL,
    `assignedByName` VARCHAR(200) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `license_assignment_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_assignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scopeType` VARCHAR(10) NOT NULL,
    `scopeId` INTEGER NOT NULL,
    `featureKey` VARCHAR(60) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `feature_assignment_scopeType_scopeId_idx`(`scopeType`, `scopeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_monitor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `snapshotDate` VARCHAR(20) NOT NULL,
    `storageMb` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `dbSizeMb` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `aiUsage` INTEGER NOT NULL DEFAULT 0,
    `apiUsage` INTEGER NOT NULL DEFAULT 0,
    `dailyTxns` INTEGER NOT NULL DEFAULT 0,
    `monthlyTxns` INTEGER NOT NULL DEFAULT 0,
    `loginCount` INTEGER NOT NULL DEFAULT 0,
    `userCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `usage_monitor_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `subscriptionId` INTEGER NULL,
    `invoiceNo` VARCHAR(40) NOT NULL,
    `invoiceType` VARCHAR(16) NOT NULL DEFAULT 'Subscription',
    `invoiceDate` VARCHAR(20) NOT NULL,
    `dueDate` VARCHAR(20) NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Sent',
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscription_invoice_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `paymentNo` VARCHAR(40) NOT NULL,
    `paymentDate` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `mode` VARCHAR(20) NOT NULL,
    `reference` VARCHAR(80) NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscription_payment_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NULL,
    `event` VARCHAR(40) NOT NULL,
    `channel` VARCHAR(12) NOT NULL DEFAULT 'Email',
    `recipient` VARCHAR(200) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Sent',
    `note` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `platform_notification_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entityType` VARCHAR(24) NOT NULL,
    `entityId` INTEGER NULL,
    `tenantId` INTEGER NULL,
    `action` VARCHAR(40) NOT NULL,
    `byUser` INTEGER NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `platform_audit_entityType_idx`(`entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `platform_user` ADD CONSTRAINT `platform_user_platformRoleId_fkey` FOREIGN KEY (`platformRoleId`) REFERENCES `platform_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_session` ADD CONSTRAINT `platform_session_platformUserId_fkey` FOREIGN KEY (`platformUserId`) REFERENCES `platform_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_workspace_history` ADD CONSTRAINT `tenant_workspace_history_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `tenant_workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_subscription` ADD CONSTRAINT `tenant_subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_subscription_history` ADD CONSTRAINT `tenant_subscription_history_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `tenant_subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `license_assignment` ADD CONSTRAINT `license_assignment_licenseConfigId_fkey` FOREIGN KEY (`licenseConfigId`) REFERENCES `license_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payment` ADD CONSTRAINT `subscription_payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `subscription_invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
