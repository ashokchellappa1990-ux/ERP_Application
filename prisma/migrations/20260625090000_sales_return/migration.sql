-- Sales-return running counter
ALTER TABLE `sales_settings` ADD COLUMN `seqReturn` INTEGER NOT NULL DEFAULT 0;

-- CreateTable: sales_returns
CREATE TABLE `sales_returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `returnNo` VARCHAR(40) NOT NULL,
    `returnDate` VARCHAR(20) NOT NULL,
    `saleId` INTEGER NULL,
    `invoiceNo` VARCHAR(40) NULL,
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(200) NULL,
    `customerPhone` VARCHAR(20) NULL,
    `grossAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discountAdj` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAdj` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refundAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refundMode` VARCHAR(20) NULL,
    `refundRef` VARCHAR(80) NULL,
    `refundRemarks` VARCHAR(300) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
    `approvedBy` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvalNote` VARCHAR(300) NULL,
    `itemCount` INTEGER NOT NULL DEFAULT 0,
    `notes` VARCHAR(300) NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `sales_returns_tenantId_returnNo_key`(`tenantId`, `returnNo`),
    INDEX `sales_returns_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `sales_returns_tenantId_returnDate_idx`(`tenantId`, `returnDate`),
    INDEX `sales_returns_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: sales_return_lines
CREATE TABLE `sales_return_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salesReturnId` INTEGER NOT NULL,
    `saleLineId` INTEGER NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(250) NOT NULL,
    `sku` VARCHAR(60) NULL,
    `soldQty` DECIMAL(18, 3) NOT NULL,
    `returnQty` DECIMAL(18, 3) NOT NULL,
    `rate` DECIMAL(18, 2) NOT NULL,
    `discAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `returnValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `cost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `reason` VARCHAR(120) NULL,
    `remarks` VARCHAR(300) NULL,
    `inventoryHandling` VARCHAR(20) NOT NULL DEFAULT 'good',
    `batchNo` VARCHAR(80) NULL,
    `mfgDate` VARCHAR(20) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `sales_return_lines_salesReturnId_idx`(`salesReturnId`),
    INDEX `sales_return_lines_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: sales_return_qrs
CREATE TABLE `sales_return_qrs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `salesReturnLineId` INTEGER NOT NULL,
    `qrCodeMappingId` INTEGER NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `mode` VARCHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `sales_return_qrs_tenantId_code_idx`(`tenantId`, `code`),
    INDEX `sales_return_qrs_salesReturnLineId_idx`(`salesReturnLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: customer_credits
CREATE TABLE `customer_credits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `customerId` INTEGER NULL,
    `creditNo` VARCHAR(40) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `balance` DECIMAL(18, 2) NOT NULL,
    `sourceType` VARCHAR(20) NOT NULL DEFAULT 'SALES_RETURN',
    `sourceId` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `customer_credits_tenantId_customerId_idx`(`tenantId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_return_lines` ADD CONSTRAINT `sales_return_lines_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `sales_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_return_qrs` ADD CONSTRAINT `sales_return_qrs_salesReturnLineId_fkey` FOREIGN KEY (`salesReturnLineId`) REFERENCES `sales_return_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_return_qrs` ADD CONSTRAINT `sales_return_qrs_qrCodeMappingId_fkey` FOREIGN KEY (`qrCodeMappingId`) REFERENCES `qr_code_mappings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
