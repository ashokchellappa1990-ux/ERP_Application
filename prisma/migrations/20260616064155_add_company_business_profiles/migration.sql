-- CreateTable
CREATE TABLE `company_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `displayName` VARCHAR(200) NOT NULL,
    `legalName` VARCHAR(200) NULL,
    `logoUrl` LONGTEXT NULL,
    `gstin` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `phone` VARCHAR(20) NULL,
    `website` VARCHAR(150) NULL,
    `addressLine1` VARCHAR(300) NULL,
    `addressLine2` VARCHAR(300) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `stateCode` VARCHAR(5) NULL,
    `pincode` VARCHAR(12) NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'India',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `company_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `businessType` VARCHAR(50) NULL,
    `industry` VARCHAR(100) NULL,
    `constitution` VARCHAR(50) NULL,
    `gstRegistrationType` VARCHAR(30) NULL,
    `pan` VARCHAR(15) NULL,
    `cin` VARCHAR(30) NULL,
    `tan` VARCHAR(20) NULL,
    `financialYearStart` VARCHAR(15) NOT NULL DEFAULT 'April',
    `baseCurrency` VARCHAR(5) NOT NULL DEFAULT 'INR',
    `defaultTaxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `turnoverRange` VARCHAR(40) NULL,
    `employeeCount` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `business_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_profiles` ADD CONSTRAINT `company_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_profiles` ADD CONSTRAINT `business_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
