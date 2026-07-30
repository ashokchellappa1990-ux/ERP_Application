-- Sales-exchange running counter
ALTER TABLE `sales_settings` ADD COLUMN `seqExchange` INTEGER NOT NULL DEFAULT 0;

-- CreateTable: sales_exchange
CREATE TABLE `sales_exchange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `exchangeNo` VARCHAR(40) NOT NULL,
    `exchangeDate` VARCHAR(20) NOT NULL,
    `originalSaleId` INTEGER NULL,
    `invoiceNo` VARCHAR(40) NULL,
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `customerPhone` VARCHAR(20) NULL,
    `channel` VARCHAR(20) NOT NULL DEFAULT 'POS',
    `returnId` INTEGER NULL,
    `newSaleId` INTEGER NULL,
    `returnValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `newSaleValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `priceDifference` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `settlementType` VARCHAR(10) NOT NULL DEFAULT 'even',
    `settlementMode` VARCHAR(20) NULL,
    `settlementRef` VARCHAR(80) NULL,
    `reason` VARCHAR(120) NULL,
    `remarks` VARCHAR(300) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
    `approvedBy` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvalNote` VARCHAR(300) NULL,
    `itemCount` INTEGER NOT NULL DEFAULT 0,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `terminalId` INTEGER NULL,
    `terminalSessionId` INTEGER NULL,
    `shiftSessionId` INTEGER NULL,
    `cashierUserId` INTEGER NULL,
    `deviceId` VARCHAR(80) NULL,
    `transactionSource` VARCHAR(20) NULL,
    `dayOpeningId` INTEGER NULL,
    `dayClosingId` INTEGER NULL,
    UNIQUE INDEX `sales_exchange_tenantId_exchangeNo_key`(`tenantId`, `exchangeNo`),
    INDEX `sales_exchange_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `sales_exchange_tenantId_branchId_exchangeDate_idx`(`tenantId`, `branchId`, `exchangeDate`),
    INDEX `sales_exchange_originalSaleId_idx`(`originalSaleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: sales_exchange_items
CREATE TABLE `sales_exchange_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exchangeId` INTEGER NOT NULL,
    `side` VARCHAR(10) NOT NULL,
    `saleLineId` INTEGER NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(250) NOT NULL,
    `sku` VARCHAR(60) NULL,
    `qty` DECIMAL(18, 3) NOT NULL,
    `rate` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxPct` DECIMAL(9, 2) NULL,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `value` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `reason` VARCHAR(120) NULL,
    `inventoryHandling` VARCHAR(20) NULL,
    `batchNo` VARCHAR(80) NULL,
    `mfgDate` VARCHAR(20) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `sales_exchange_items_exchangeId_idx`(`exchangeId`),
    INDEX `sales_exchange_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `sales_exchange` ADD CONSTRAINT `sales_exchange_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_exchange_items` ADD CONSTRAINT `sales_exchange_items_exchangeId_fkey` FOREIGN KEY (`exchangeId`) REFERENCES `sales_exchange`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
