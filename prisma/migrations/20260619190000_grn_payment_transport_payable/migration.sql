-- GRN: GST mode, charges, invoice value, payment, transport
ALTER TABLE `goods_receipt_notes`
  ADD COLUMN `gstMode` VARCHAR(10) NOT NULL DEFAULT 'line',
  ADD COLUMN `gstPct` DECIMAL(9,2) NULL,
  ADD COLUMN `subtotal` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `taxTotal` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `freightAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `otherCharges` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `roundOff` DECIMAL(9,2) NOT NULL DEFAULT 0,
  ADD COLUMN `totalInvoiceValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `paymentStatus` VARCHAR(12) NOT NULL DEFAULT 'Unpaid',
  ADD COLUMN `amountPaid` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `paymentMode` VARCHAR(20) NULL,
  ADD COLUMN `paymentRef` VARCHAR(80) NULL,
  ADD COLUMN `paymentDate` VARCHAR(20) NULL,
  ADD COLUMN `paymentTerms` VARCHAR(120) NULL,
  ADD COLUMN `creditDays` INTEGER NULL,
  ADD COLUMN `dueDate` VARCHAR(20) NULL,
  ADD COLUMN `transporterName` VARCHAR(150) NULL,
  ADD COLUMN `transportMode` VARCHAR(20) NULL,
  ADD COLUMN `vehicleNo` VARCHAR(40) NULL,
  ADD COLUMN `lrNo` VARCHAR(60) NULL,
  ADD COLUMN `ewayBillNo` VARCHAR(40) NULL,
  ADD COLUMN `freightPaidBy` VARCHAR(20) NULL,
  ADD COLUMN `numPackages` INTEGER NULL,
  ADD COLUMN `transportRemarks` VARCHAR(300) NULL;

-- CreateTable: payables
CREATE TABLE `payables` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `sourceType` VARCHAR(20) NOT NULL,
  `sourceId` INTEGER NOT NULL,
  `refNo` VARCHAR(40) NULL,
  `supplier` VARCHAR(200) NULL,
  `docDate` VARCHAR(20) NULL,
  `dueDate` VARCHAR(20) NULL,
  `paymentTerms` VARCHAR(120) NULL,
  `totalAmount` DECIMAL(18,2) NOT NULL,
  `paidAmount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `balanceAmount` DECIMAL(18,2) NOT NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'Open',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `payables_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `payables_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `payables` ADD CONSTRAINT `payables_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
