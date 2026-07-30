-- CreateTable: pos_terminals
CREATE TABLE `pos_terminals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `type` VARCHAR(30) NOT NULL DEFAULT 'Desktop POS',
    `description` TEXT NULL,
    `warehouse` VARCHAR(120) NULL,
    `defaultCustomerId` INTEGER NULL,
    `receiptTemplateId` INTEGER NULL,
    `defaultWarehouse` VARCHAR(120) NULL,
    `defaultSalesType` VARCHAR(40) NULL,
    `defaultPriceList` VARCHAR(80) NULL,
    `defaultTaxProfile` VARCHAR(80) NULL,
    `invoiceSeries` VARCHAR(40) NULL,
    `ipAddress` VARCHAR(60) NULL,
    `deviceId` VARCHAR(80) NULL,
    `macAddress` VARCHAR(60) NULL,
    `deviceAuthRequired` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `config` JSON NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `pos_terminals_tenantId_code_key`(`tenantId`, `code`),
    INDEX `pos_terminals_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `pos_terminals_tenantId_branchId_idx`(`tenantId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: shifts
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `startTime` VARCHAR(10) NOT NULL DEFAULT '09:00',
    `endTime` VARCHAR(10) NOT NULL DEFAULT '21:00',
    `crossDay` BOOLEAN NOT NULL DEFAULT false,
    `gracePeriodMins` INTEGER NULL,
    `openingCashMandatory` BOOLEAN NOT NULL DEFAULT true,
    `closingCashMandatory` BOOLEAN NOT NULL DEFAULT true,
    `physicalCountRequired` BOOLEAN NOT NULL DEFAULT false,
    `managerApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
    `maxCashDifference` DECIMAL(18, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `config` JSON NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `shifts_tenantId_code_key`(`tenantId`, `code`),
    INDEX `shifts_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: terminal_shift_maps
CREATE TABLE `terminal_shift_maps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `terminalId` INTEGER NOT NULL,
    `shiftId` INTEGER NOT NULL,
    `effectiveFrom` VARCHAR(20) NULL,
    `effectiveTo` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `terminal_shift_maps_tenantId_terminalId_idx`(`tenantId`, `terminalId`),
    INDEX `terminal_shift_maps_tenantId_shiftId_idx`(`tenantId`, `shiftId`),
    INDEX `terminal_shift_maps_terminalId_idx`(`terminalId`),
    INDEX `terminal_shift_maps_shiftId_idx`(`shiftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: terminal_sessions
CREATE TABLE `terminal_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `sessionNo` VARCHAR(40) NOT NULL,
    `terminalId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `cashierUserId` INTEGER NOT NULL,
    `loginAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `logoutAt` DATETIME(3) NULL,
    `openingCash` DECIMAL(18, 2) NULL,
    `closingCash` DECIMAL(18, 2) NULL,
    `expectedCash` DECIMAL(18, 2) NULL,
    `cashDifference` DECIMAL(18, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Open',
    `openingNote` VARCHAR(300) NULL,
    `closingNote` VARCHAR(300) NULL,
    `approvedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `terminal_sessions_tenantId_sessionNo_key`(`tenantId`, `sessionNo`),
    INDEX `terminal_sessions_tenantId_terminalId_status_idx`(`tenantId`, `terminalId`, `status`),
    INDEX `terminal_sessions_tenantId_cashierUserId_idx`(`tenantId`, `cashierUserId`),
    INDEX `terminal_sessions_terminalId_idx`(`terminalId`),
    INDEX `terminal_sessions_shiftId_idx`(`shiftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pos_terminals` ADD CONSTRAINT `pos_terminals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_shift_maps` ADD CONSTRAINT `terminal_shift_maps_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_shift_maps` ADD CONSTRAINT `terminal_shift_maps_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `pos_terminals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_shift_maps` ADD CONSTRAINT `terminal_shift_maps_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_sessions` ADD CONSTRAINT `terminal_sessions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_sessions` ADD CONSTRAINT `terminal_sessions_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `pos_terminals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `terminal_sessions` ADD CONSTRAINT `terminal_sessions_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: additive POS traceability columns on the 8 transaction headers
ALTER TABLE `sales`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;
CREATE INDEX `sales_terminalSessionId_idx` ON `sales`(`terminalSessionId`);

ALTER TABLE `sales_returns`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;

ALTER TABLE `goods_receipt_notes`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;

ALTER TABLE `supplier_payments`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;

ALTER TABLE `customer_collections`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;

ALTER TABLE `petty_cash_vouchers`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;

ALTER TABLE `journal_entries`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;

ALTER TABLE `opening_stock`
    ADD COLUMN `terminalId` INTEGER NULL,
    ADD COLUMN `terminalSessionId` INTEGER NULL,
    ADD COLUMN `shiftSessionId` INTEGER NULL,
    ADD COLUMN `cashierUserId` INTEGER NULL,
    ADD COLUMN `deviceId` VARCHAR(80) NULL,
    ADD COLUMN `transactionSource` VARCHAR(20) NULL;
