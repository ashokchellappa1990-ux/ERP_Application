-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(100) NOT NULL,
    `value` LONGTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(150) NOT NULL,
    `countryCode` VARCHAR(6) NOT NULL DEFAULT '+91',
    `mobile` VARCHAR(15) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `username` VARCHAR(60) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `businessName` VARCHAR(200) NOT NULL,
    `businessType` VARCHAR(50) NOT NULL,
    `role` VARCHAR(30) NOT NULL DEFAULT 'owner',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `mobileVerified` BOOLEAN NOT NULL DEFAULT false,
    `emailVerifiedAt` DATETIME(3) NULL,
    `mobileVerifiedAt` DATETIME(3) NULL,
    `otpCode` VARCHAR(10) NULL,
    `otpExpiresAt` DATETIME(3) NULL,
    `otpAttempts` INTEGER NOT NULL DEFAULT 0,
    `registrationSource` VARCHAR(20) NOT NULL DEFAULT 'web',
    `authProvider` VARCHAR(30) NULL,
    `authProviderId` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `agreedToTerms` BOOLEAN NOT NULL DEFAULT false,
    `termsAcceptedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_mobile_key`(`mobile`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_mobile_idx`(`mobile`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_username_idx`(`username`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
