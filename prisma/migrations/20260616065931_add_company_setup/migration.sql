-- CreateTable
CREATE TABLE `company_setups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `mode` VARCHAR(20) NOT NULL DEFAULT 'standard',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `companyName` VARCHAR(200) NULL,
    `legalName` VARCHAR(200) NULL,
    `businessType` VARCHAR(100) NULL,
    `industry` VARCHAR(120) NULL,
    `nature` VARCHAR(250) NULL,
    `established` VARCHAR(20) NULL,
    `companyEmail` VARCHAR(150) NULL,
    `companyPhone` VARCHAR(30) NULL,
    `website` VARCHAR(150) NULL,
    `gstNumber` VARCHAR(20) NULL,
    `pan` VARCHAR(15) NULL,
    `cin` VARCHAR(30) NULL,
    `udyam` VARCHAR(40) NULL,
    `fssai` VARCHAR(20) NULL,
    `drugLicense` VARCHAR(40) NULL,
    `addressLine` VARCHAR(300) NULL,
    `country` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `employees` VARCHAR(20) NULL,
    `turnover` VARCHAR(40) NULL,
    `ownership` VARCHAR(40) NULL,
    `startTime` VARCHAR(10) NULL,
    `endTime` VARCHAR(10) NULL,
    `workingDays` JSON NULL,
    `primaryContact` JSON NULL,
    `secondaryContact` JSON NULL,
    `orgType` VARCHAR(30) NULL,
    `fyStart` VARCHAR(20) NULL,
    `fyEnd` VARCHAR(20) NULL,
    `acctStart` VARCHAR(20) NULL,
    `currency` VARCHAR(10) NULL,
    `accountingMethod` VARCHAR(20) NULL,
    `costCenter` VARCHAR(120) NULL,
    `profitCenter` VARCHAR(120) NULL,
    `gstin` VARCHAR(20) NULL,
    `gstPan` VARCHAR(15) NULL,
    `gstStateCode` VARCHAR(5) NULL,
    `gstEffective` VARCHAR(20) NULL,
    `gstRegType` VARCHAR(30) NULL,
    `gstFrequency` VARCHAR(20) NULL,
    `adminContact` JSON NULL,
    `inventoryValuation` VARCHAR(20) NULL,
    `paymentDefault` VARCHAR(20) NULL,
    `migrationSource` VARCHAR(30) NULL,
    `industrySelected` VARCHAR(120) NULL,
    `toggles` JSON NULL,
    `flags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `company_setups_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setup_branches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setupId` INTEGER NOT NULL,
    `name` VARCHAR(150) NULL,
    `code` VARCHAR(40) NULL,
    `type` VARCHAR(40) NULL,
    `address` VARCHAR(300) NULL,
    `state` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `manager` VARCHAR(150) NULL,

    INDEX `setup_branches_setupId_idx`(`setupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setup_warehouses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setupId` INTEGER NOT NULL,
    `name` VARCHAR(150) NULL,
    `code` VARCHAR(40) NULL,
    `type` VARCHAR(40) NULL,
    `address` VARCHAR(300) NULL,
    `contact` VARCHAR(150) NULL,
    `mobile` VARCHAR(30) NULL,
    `capacity` VARCHAR(60) NULL,
    `branch` VARCHAR(150) NULL,

    INDEX `setup_warehouses_setupId_idx`(`setupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setup_banks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setupId` INTEGER NOT NULL,
    `bankName` VARCHAR(150) NULL,
    `branch` VARCHAR(150) NULL,
    `account` VARCHAR(40) NULL,
    `ifsc` VARCHAR(20) NULL,
    `type` VARCHAR(30) NULL,
    `upi` VARCHAR(100) NULL,

    INDEX `setup_banks_setupId_idx`(`setupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setup_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setupId` INTEGER NOT NULL,
    `name` VARCHAR(150) NULL,
    `mobile` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `username` VARCHAR(60) NULL,
    `role` VARCHAR(60) NULL,

    INDEX `setup_users_setupId_idx`(`setupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_setups` ADD CONSTRAINT `company_setups_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `setup_branches` ADD CONSTRAINT `setup_branches_setupId_fkey` FOREIGN KEY (`setupId`) REFERENCES `company_setups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `setup_warehouses` ADD CONSTRAINT `setup_warehouses_setupId_fkey` FOREIGN KEY (`setupId`) REFERENCES `company_setups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `setup_banks` ADD CONSTRAINT `setup_banks_setupId_fkey` FOREIGN KEY (`setupId`) REFERENCES `company_setups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `setup_users` ADD CONSTRAINT `setup_users_setupId_fkey` FOREIGN KEY (`setupId`) REFERENCES `company_setups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
