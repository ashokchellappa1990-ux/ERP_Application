-- CreateTable: day_opening
CREATE TABLE `day_opening` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `dayOpeningNo` VARCHAR(40) NOT NULL,
    `openingDate` VARCHAR(20) NOT NULL,
    `openingAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `terminalId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `terminalSessionId` INTEGER NULL,
    `cashierUserId` INTEGER NOT NULL,
    `openingCash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `openingBankBalance` DECIMAL(18, 2) NULL,
    `openingSafeBalance` DECIMAL(18, 2) NULL,
    `openingPettyCash` DECIMAL(18, 2) NULL,
    `remarks` VARCHAR(300) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Open',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `day_opening_tenantId_dayOpeningNo_key`(`tenantId`, `dayOpeningNo`),
    INDEX `day_opening_tenantId_branchId_openingDate_idx`(`tenantId`, `branchId`, `openingDate`),
    INDEX `day_opening_tenantId_terminalSessionId_idx`(`tenantId`, `terminalSessionId`),
    INDEX `day_opening_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: cash_declaration
CREATE TABLE `cash_declaration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `dayOpeningId` INTEGER NOT NULL,
    `terminalId` INTEGER NOT NULL,
    `terminalSessionId` INTEGER NULL,
    `cashierUserId` INTEGER NOT NULL,
    `expectedCash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `physicalCount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `excess` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `shortage` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `difference` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `denominations` JSON NULL,
    `remarks` VARCHAR(300) NULL,
    `approvalStatus` VARCHAR(20) NOT NULL DEFAULT 'NotRequired',
    `approvedBy` INTEGER NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `cash_declaration_tenantId_dayOpeningId_idx`(`tenantId`, `dayOpeningId`),
    INDEX `cash_declaration_tenantId_terminalSessionId_idx`(`tenantId`, `terminalSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: shift_closing
CREATE TABLE `shift_closing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `dayOpeningId` INTEGER NOT NULL,
    `terminalId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `terminalSessionId` INTEGER NULL,
    `cashierUserId` INTEGER NOT NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validations` JSON NULL,
    `summary` JSON NULL,
    `expectedCash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `countedCash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `difference` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Closed',
    `approvedBy` INTEGER NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `shift_closing_tenantId_dayOpeningId_idx`(`tenantId`, `dayOpeningId`),
    INDEX `shift_closing_tenantId_branchId_idx`(`tenantId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: terminal_cash_transaction
CREATE TABLE `terminal_cash_transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `txnNo` VARCHAR(40) NULL,
    `dayOpeningId` INTEGER NULL,
    `terminalId` INTEGER NOT NULL,
    `terminalSessionId` INTEGER NULL,
    `cashierUserId` INTEGER NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `reason` VARCHAR(300) NULL,
    `voucherRef` VARCHAR(80) NULL,
    `approvalStatus` VARCHAR(20) NOT NULL DEFAULT 'NotRequired',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `terminal_cash_transaction_tenantId_dayOpeningId_idx`(`tenantId`, `dayOpeningId`),
    INDEX `terminal_cash_transaction_tenantId_terminalId_idx`(`tenantId`, `terminalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: terminal_fund_transfer
CREATE TABLE `terminal_fund_transfer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `transferNo` VARCHAR(40) NULL,
    `fromTerminalId` INTEGER NOT NULL,
    `toTerminalId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `reason` VARCHAR(300) NULL,
    `transferredBy` INTEGER NOT NULL,
    `receivedBy` INTEGER NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Requested',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `terminal_fund_transfer_tenantId_fromTerminalId_idx`(`tenantId`, `fromTerminalId`),
    INDEX `terminal_fund_transfer_tenantId_toTerminalId_idx`(`tenantId`, `toTerminalId`),
    INDEX `terminal_fund_transfer_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: safe_locker_transaction
CREATE TABLE `safe_locker_transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `txnNo` VARCHAR(40) NULL,
    `direction` VARCHAR(30) NOT NULL,
    `terminalId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `transferredBy` INTEGER NULL,
    `receivedBy` INTEGER NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `reason` VARCHAR(300) NULL,
    `refType` VARCHAR(30) NULL,
    `refId` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Completed',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `safe_locker_transaction_tenantId_branchId_createdAt_idx`(`tenantId`, `branchId`, `createdAt`),
    INDEX `safe_locker_transaction_tenantId_direction_idx`(`tenantId`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: bank_deposit
CREATE TABLE `bank_deposit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `depositNo` VARCHAR(40) NULL,
    `bankName` VARCHAR(120) NOT NULL,
    `bankAccount` VARCHAR(60) NULL,
    `depositSlip` VARCHAR(80) NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `depositDate` VARCHAR(20) NOT NULL,
    `depositAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `depositBy` INTEGER NOT NULL,
    `remarks` VARCHAR(300) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Completed',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `bank_deposit_tenantId_branchId_depositDate_idx`(`tenantId`, `branchId`, `depositDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: terminal_closing_summary
CREATE TABLE `terminal_closing_summary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `dayDate` VARCHAR(20) NOT NULL,
    `terminalId` INTEGER NOT NULL,
    `terminalSessionId` INTEGER NULL,
    `openingCash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `closingCash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `difference` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totals` JSON NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `terminal_closing_summary_tenantId_branchId_dayDate_idx`(`tenantId`, `branchId`, `dayDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: day_closing
CREATE TABLE `day_closing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `dayClosingNo` VARCHAR(40) NOT NULL,
    `closingDate` VARCHAR(20) NOT NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(20) NOT NULL DEFAULT 'Closed',
    `remarks` VARCHAR(300) NULL,
    `approvedBy` INTEGER NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `day_closing_tenantId_dayClosingNo_key`(`tenantId`, `dayClosingNo`),
    INDEX `day_closing_tenantId_branchId_closingDate_idx`(`tenantId`, `branchId`, `closingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: day_summary
CREATE TABLE `day_summary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `dayDate` VARCHAR(20) NOT NULL,
    `dayClosingId` INTEGER NULL,
    `summary` JSON NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `day_summary_tenantId_branchId_dayDate_key`(`tenantId`, `branchId`, `dayDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey (tenant cascade on all EOD tables)
ALTER TABLE `day_opening` ADD CONSTRAINT `day_opening_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `cash_declaration` ADD CONSTRAINT `cash_declaration_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `shift_closing` ADD CONSTRAINT `shift_closing_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_cash_transaction` ADD CONSTRAINT `terminal_cash_transaction_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_fund_transfer` ADD CONSTRAINT `terminal_fund_transfer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `safe_locker_transaction` ADD CONSTRAINT `safe_locker_transaction_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bank_deposit` ADD CONSTRAINT `bank_deposit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_closing_summary` ADD CONSTRAINT `terminal_closing_summary_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `day_closing` ADD CONSTRAINT `day_closing_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `day_summary` ADD CONSTRAINT `day_summary_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: link the 8 transaction headers to their EOD day (additive, nullable)
ALTER TABLE `sales` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `sales_returns` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `goods_receipt_notes` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `supplier_payments` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `customer_collections` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `petty_cash_vouchers` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `journal_entries` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
ALTER TABLE `opening_stock` ADD COLUMN `dayOpeningId` INTEGER NULL, ADD COLUMN `dayClosingId` INTEGER NULL;
