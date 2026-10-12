-- CreateTable
CREATE TABLE `opening_stock` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `docNo` VARCHAR(40) NOT NULL,
  `asOnDate` VARCHAR(20) NOT NULL,
  `warehouse` VARCHAR(120) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
  `notes` TEXT NULL,
  `totalQty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `totalValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `lineCount` INTEGER NOT NULL DEFAULT 0,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `opening_stock_docNo_key`(`docNo`),
  INDEX `opening_stock_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opening_stock_lines` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `openingStockId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `productName` VARCHAR(250) NOT NULL,
  `sku` VARCHAR(60) NULL,
  `uom` VARCHAR(40) NULL,
  `category` VARCHAR(120) NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `mrp` DECIMAL(18,2) NULL,
  `purchasePrice` DECIMAL(18,2) NULL,
  `value` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `batchNo` VARCHAR(80) NULL,
  `mfgDate` VARCHAR(20) NULL,
  `expiryDate` VARCHAR(20) NULL,
  `supplier` VARCHAR(150) NULL,
  `purchaseRef` VARCHAR(80) NULL,
  `purchaseDate` VARCHAR(20) NULL,
  `remarks` VARCHAR(300) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `opening_stock_lines_openingStockId_idx`(`openingStockId`),
  INDEX `opening_stock_lines_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `opening_stock_lines` ADD CONSTRAINT `opening_stock_lines_openingStockId_fkey` FOREIGN KEY (`openingStockId`) REFERENCES `opening_stock`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_lines` ADD CONSTRAINT `opening_stock_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
