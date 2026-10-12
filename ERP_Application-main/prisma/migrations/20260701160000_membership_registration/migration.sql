-- Membership Registration: 6 tables + customers membership columns.

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `isMember` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `membershipExpiry` VARCHAR(20) NULL,
    ADD COLUMN `membershipLevelId` INTEGER NULL,
    ADD COLUMN `membershipNumber` VARCHAR(60) NULL,
    ADD COLUMN `membershipStatus` VARCHAR(12) NULL;

-- CreateTable
CREATE TABLE `membership_registration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `registrationNo` VARCHAR(40) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `levelId` INTEGER NOT NULL,
    `membershipType` VARCHAR(20) NOT NULL,
    `membershipNumber` VARCHAR(60) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'Draft',
    `registrationDate` VARCHAR(20) NOT NULL,
    `activationDate` VARCHAR(20) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `qualified` BOOLEAN NOT NULL DEFAULT false,
    `qualificationNote` VARCHAR(500) NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `feeAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `paymentMode` VARCHAR(20) NULL,
    `paymentRef` VARCHAR(80) NULL,
    `registeredBy` INTEGER NULL,
    `registeredByName` VARCHAR(200) NULL,
    `approvedBy` INTEGER NULL,
    `approvedByName` VARCHAR(200) NULL,
    `remarks` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `membership_registration_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `membership_registration_customerId_idx`(`customerId`),
    INDEX `membership_registration_levelId_idx`(`levelId`),
    UNIQUE INDEX `membership_registration_tenantId_registrationNo_key`(`tenantId`, `registrationNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_registration_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `registrationId` INTEGER NOT NULL,
    `fromStatus` VARCHAR(16) NULL,
    `toStatus` VARCHAR(16) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `byUser` INTEGER NULL,
    `byName` VARCHAR(200) NULL,
    `note` VARCHAR(400) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_registration_history_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_activation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `registrationId` INTEGER NOT NULL,
    `membershipNumber` VARCHAR(60) NOT NULL,
    `activationDate` VARCHAR(20) NOT NULL,
    `expiryDate` VARCHAR(20) NULL,
    `activatedBy` INTEGER NULL,
    `activatedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_activation_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_fee_receipt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `registrationId` INTEGER NOT NULL,
    `receiptNo` VARCHAR(40) NOT NULL,
    `receiptDate` VARCHAR(20) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `feeAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `paymentMode` VARCHAR(20) NOT NULL,
    `paymentRef` VARCHAR(80) NULL,
    `journalRef` VARCHAR(40) NULL,
    `createdBy` INTEGER NULL,
    `createdByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_fee_receipt_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_card` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `registrationId` INTEGER NOT NULL,
    `cardNumber` VARCHAR(60) NOT NULL,
    `membershipNumber` VARCHAR(60) NOT NULL,
    `levelId` INTEGER NOT NULL,
    `qrData` VARCHAR(200) NULL,
    `barcodeData` VARCHAR(200) NULL,
    `issueDate` VARCHAR(20) NOT NULL,
    `expiryDate` VARCHAR(20) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'Active',
    `reprintCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_card_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `registrationId` INTEGER NOT NULL,
    `docType` VARCHAR(24) NOT NULL,
    `generatedBy` INTEGER NULL,
    `generatedByName` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_document_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `membership_registration_history` ADD CONSTRAINT `membership_registration_history_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `membership_registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_activation` ADD CONSTRAINT `membership_activation_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `membership_registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_fee_receipt` ADD CONSTRAINT `membership_fee_receipt_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `membership_registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_card` ADD CONSTRAINT `membership_card_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `membership_registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_document` ADD CONSTRAINT `membership_document_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `membership_registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
