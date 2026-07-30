-- GRN line selling price
ALTER TABLE `goods_receipt_lines` ADD COLUMN `sellingPrice` DECIMAL(18,2) NULL AFTER `rate`;

-- CreateTable: suppliers
CREATE TABLE `suppliers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `gstin` VARCHAR(20) NULL,
  `contactPerson` VARCHAR(120) NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(150) NULL,
  `address` VARCHAR(300) NULL,
  `city` VARCHAR(80) NULL,
  `state` VARCHAR(80) NULL,
  `pincode` VARCHAR(12) NULL,
  `paymentTerms` VARCHAR(60) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `suppliers_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
