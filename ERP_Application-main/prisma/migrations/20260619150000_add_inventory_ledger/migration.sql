-- CreateTable: inventory_ledger (movement log / kardex)
CREATE TABLE `inventory_ledger` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `qrCode` VARCHAR(80) NULL,
  `txnType` VARCHAR(20) NOT NULL,
  `direction` VARCHAR(3) NOT NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `rate` DECIMAL(18,2) NULL,
  `value` DECIMAL(18,2) NULL,
  `balanceQty` DECIMAL(18,3) NOT NULL,
  `warehouse` VARCHAR(120) NULL,
  `batchNo` VARCHAR(80) NULL,
  `expiryDate` VARCHAR(20) NULL,
  `refType` VARCHAR(30) NULL,
  `refId` INTEGER NULL,
  `refNo` VARCHAR(40) NULL,
  `txnDate` VARCHAR(20) NOT NULL,
  `remarks` VARCHAR(300) NULL,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `inventory_ledger_tenantId_productId_idx`(`tenantId`, `productId`),
  INDEX `inventory_ledger_tenantId_txnDate_idx`(`tenantId`, `txnDate`),
  INDEX `inventory_ledger_tenantId_qrCode_idx`(`tenantId`, `qrCode`),
  INDEX `inventory_ledger_tenantId_txnType_idx`(`tenantId`, `txnType`),
  INDEX `inventory_ledger_refType_refId_idx`(`refType`, `refId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: inventory_balances (current on-hand)
CREATE TABLE `inventory_balances` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `warehouse` VARCHAR(120) NOT NULL DEFAULT 'Main Store',
  `qtyOnHand` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `avgRate` DECIMAL(18,2) NULL,
  `value` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `lastMovementAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_balances_tenantId_productId_warehouse_key`(`tenantId`, `productId`, `warehouse`),
  INDEX `inventory_balances_tenantId_productId_idx`(`tenantId`, `productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `inventory_ledger` ADD CONSTRAINT `inventory_ledger_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_ledger` ADD CONSTRAINT `inventory_ledger_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
