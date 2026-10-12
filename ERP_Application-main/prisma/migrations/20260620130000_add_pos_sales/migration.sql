-- CreateTable: customers
CREATE TABLE `customers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(150) NULL,
  `gstin` VARCHAR(20) NULL,
  `address` VARCHAR(300) NULL,
  `city` VARCHAR(80) NULL,
  `state` VARCHAR(80) NULL,
  `loyaltyPoints` INTEGER NOT NULL DEFAULT 0,
  `totalSpent` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `customers_tenantId_idx`(`tenantId`),
  INDEX `customers_tenantId_phone_idx`(`tenantId`, `phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `customers` ADD CONSTRAINT `customers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: sales
CREATE TABLE `sales` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `invoiceNo` VARCHAR(40) NOT NULL,
  `saleDate` VARCHAR(20) NOT NULL,
  `channel` VARCHAR(20) NOT NULL DEFAULT 'POS',
  `status` VARCHAR(20) NOT NULL DEFAULT 'Completed',
  `customerId` INTEGER NULL,
  `customerName` VARCHAR(200) NULL,
  `customerPhone` VARCHAR(20) NULL,
  `warehouse` VARCHAR(120) NULL,
  `subtotal` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `itemDiscount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `billDiscount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `taxableValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `cgst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `sgst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `igst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `taxTotal` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `roundOff` DECIMAL(9,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `cost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `amountPaid` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `changeDue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `paymentMode` VARCHAR(40) NULL,
  `paymentStatus` VARCHAR(12) NOT NULL DEFAULT 'Paid',
  `notes` TEXT NULL,
  `itemCount` INTEGER NOT NULL DEFAULT 0,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `sales_tenantId_invoiceNo_key`(`tenantId`, `invoiceNo`),
  INDEX `sales_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `sales_tenantId_saleDate_idx`(`tenantId`, `saleDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `sales` ADD CONSTRAINT `sales_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales` ADD CONSTRAINT `sales_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: sale_lines
CREATE TABLE `sale_lines` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `productName` VARCHAR(250) NOT NULL,
  `sku` VARCHAR(60) NULL,
  `hsn` VARCHAR(20) NULL,
  `uom` VARCHAR(40) NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `mrp` DECIMAL(18,2) NULL,
  `rate` DECIMAL(18,2) NOT NULL,
  `discPct` DECIMAL(9,2) NULL,
  `discAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `taxPct` DECIMAL(9,2) NULL,
  `taxableValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `value` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `cost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `sale_lines_saleId_idx`(`saleId`),
  INDEX `sale_lines_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: sale_payments
CREATE TABLE `sale_payments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NOT NULL,
  `mode` VARCHAR(30) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `reference` VARCHAR(80) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `sale_payments_saleId_idx`(`saleId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `sale_payments` ADD CONSTRAINT `sale_payments_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
