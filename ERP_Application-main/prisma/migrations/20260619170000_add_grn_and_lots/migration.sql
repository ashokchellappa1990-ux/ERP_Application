-- inventory_ledger: direct GRN reference
ALTER TABLE `inventory_ledger` ADD COLUMN `grnId` INTEGER NULL;
CREATE INDEX `inventory_ledger_grnId_idx` ON `inventory_ledger`(`grnId`);

-- Generalise qr_code_mappings (opening-stock line -> source-agnostic)
ALTER TABLE `qr_code_mappings` ADD COLUMN `sourceType` VARCHAR(12) NOT NULL DEFAULT 'OPENING';
ALTER TABLE `qr_code_mappings` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `qr_code_mappings` DROP FOREIGN KEY `qr_code_mappings_lineId_fkey`;
DROP INDEX `qr_code_mappings_lineId_idx` ON `qr_code_mappings`;
ALTER TABLE `qr_code_mappings` CHANGE COLUMN `lineId` `sourceId` INTEGER NOT NULL;
UPDATE `qr_code_mappings` m JOIN `opening_stock_lines` l ON l.`id`=m.`sourceId` JOIN `opening_stock` o ON o.`id`=l.`openingStockId` SET m.`tenantId`=o.`tenantId`;
ALTER TABLE `qr_code_mappings` ALTER COLUMN `tenantId` DROP DEFAULT;
CREATE INDEX `qr_code_mappings_sourceType_sourceId_idx` ON `qr_code_mappings`(`sourceType`, `sourceId`);
CREATE INDEX `qr_code_mappings_tenantId_idx` ON `qr_code_mappings`(`tenantId`);
ALTER TABLE `qr_code_mappings` ADD CONSTRAINT `qr_code_mappings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: inventory_lots (stock layers / age-wise)
CREATE TABLE `inventory_lots` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `warehouse` VARCHAR(120) NOT NULL DEFAULT 'Main Store',
  `batchNo` VARCHAR(80) NULL,
  `grnId` INTEGER NULL,
  `refType` VARCHAR(30) NULL,
  `refId` INTEGER NULL,
  `refNo` VARCHAR(40) NULL,
  `receivedDate` VARCHAR(20) NULL,
  `purchaseDate` VARCHAR(20) NULL,
  `expiryDate` VARCHAR(20) NULL,
  `receivedQty` DECIMAL(18,3) NOT NULL,
  `qtyOnHand` DECIMAL(18,3) NOT NULL,
  `unitRate` DECIMAL(18,2) NULL,
  `value` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `inventory_lots_tenantId_productId_idx`(`tenantId`, `productId`),
  INDEX `inventory_lots_tenantId_receivedDate_idx`(`tenantId`, `receivedDate`),
  INDEX `inventory_lots_grnId_idx`(`grnId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `inventory_lots` ADD CONSTRAINT `inventory_lots_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_lots` ADD CONSTRAINT `inventory_lots_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: goods_receipt_notes
CREATE TABLE `goods_receipt_notes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `grnNo` VARCHAR(40) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
  `grnDate` VARCHAR(20) NOT NULL,
  `supplier` VARCHAR(200) NULL,
  `supplierGstin` VARCHAR(20) NULL,
  `supplierContact` VARCHAR(120) NULL,
  `supplierInvoiceNo` VARCHAR(60) NULL,
  `supplierInvoiceDate` VARCHAR(20) NULL,
  `poNo` VARCHAR(60) NULL,
  `warehouse` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `totalQty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `totalValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `lineCount` INTEGER NOT NULL DEFAULT 0,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `goods_receipt_notes_tenantId_grnNo_key`(`tenantId`, `grnNo`),
  INDEX `goods_receipt_notes_tenantId_status_idx`(`tenantId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `goods_receipt_notes` ADD CONSTRAINT `goods_receipt_notes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: goods_receipt_lines
CREATE TABLE `goods_receipt_lines` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `grnId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `productName` VARCHAR(250) NOT NULL,
  `sku` VARCHAR(60) NULL,
  `uom` VARCHAR(40) NULL,
  `category` VARCHAR(120) NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `freeQty` DECIMAL(18,3) NULL,
  `rate` DECIMAL(18,2) NULL,
  `discPct` DECIMAL(9,2) NULL,
  `taxPct` DECIMAL(9,2) NULL,
  `taxAmount` DECIMAL(18,2) NULL,
  `value` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `mrp` DECIMAL(18,2) NULL,
  `batchNo` VARCHAR(80) NULL,
  `mfgDate` VARCHAR(20) NULL,
  `expiryDate` VARCHAR(20) NULL,
  `remarks` VARCHAR(300) NULL,
  `qrMode` VARCHAR(10) NOT NULL DEFAULT 'shared',
  `qrStatus` VARCHAR(20) NOT NULL DEFAULT 'Pending',
  `qrGeneratedCount` INTEGER NOT NULL DEFAULT 0,
  `printedQty` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `goods_receipt_lines_grnId_idx`(`grnId`),
  INDEX `goods_receipt_lines_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `goods_receipt_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `goods_receipt_lines` ADD CONSTRAINT `goods_receipt_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
