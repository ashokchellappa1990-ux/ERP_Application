-- GRN: purchase-invoice / supplier-bill linkage
ALTER TABLE `goods_receipt_notes`
  ADD COLUMN `purchaseInvoiceId` INTEGER NULL,
  ADD COLUMN `invoiceStatus` VARCHAR(20) NOT NULL DEFAULT 'Pending',
  ADD COLUMN `invoiceRecorded` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `accountsPosted` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: purchase_settings
CREATE TABLE `purchase_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `config` JSON NOT NULL,
    `seqPI` INTEGER NOT NULL DEFAULT 0,
    `seqPeriod` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `purchase_settings_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: purchase_invoice
CREATE TABLE `purchase_invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `invoiceNo` VARCHAR(40) NOT NULL,
    `supplierInvoiceNo` VARCHAR(80) NULL,
    `supplierInvoiceDate` VARCHAR(20) NULL,
    `supplierBillNo` VARCHAR(80) NULL,
    `supplierBillDate` VARCHAR(20) NULL,
    `dueDate` VARCHAR(20) NULL,
    `paymentTerms` VARCHAR(120) NULL,
    `creditDays` INTEGER NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `supplierRef` VARCHAR(80) NULL,
    `supplierId` INTEGER NULL,
    `supplier` VARCHAR(200) NULL,
    `supplierGstin` VARCHAR(20) NULL,
    `poNo` VARCHAR(60) NULL,
    `warehouse` VARCHAR(120) NULL,
    `purchaseType` VARCHAR(20) NOT NULL DEFAULT 'Inventory',
    `grnAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `additionalDiscount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `freight` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `loading` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `packing` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `insurance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherCharges` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `roundOff` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `cgst` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `sgst` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `igst` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `cess` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gstAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gstApplicable` BOOLEAN NOT NULL DEFAULT true,
    `reverseCharge` BOOLEAN NOT NULL DEFAULT false,
    `totalInvoiceAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netPayable` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
    `accountsPosted` BOOLEAN NOT NULL DEFAULT false,
    `journalRef` VARCHAR(40) NULL,
    `payableId` INTEGER NULL,
    `approvedBy` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvalNote` VARCHAR(300) NULL,
    `remarks` VARCHAR(500) NULL,
    `internalNotes` VARCHAR(500) NULL,
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
    UNIQUE INDEX `purchase_invoice_tenantId_invoiceNo_key`(`tenantId`, `invoiceNo`),
    INDEX `purchase_invoice_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `purchase_invoice_tenantId_branchId_supplierInvoiceDate_idx`(`tenantId`, `branchId`, `supplierInvoiceDate`),
    INDEX `purchase_invoice_tenantId_supplier_idx`(`tenantId`, `supplier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: purchase_invoice_items
CREATE TABLE `purchase_invoice_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseInvoiceId` INTEGER NOT NULL,
    `grnLineId` INTEGER NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(250) NOT NULL,
    `sku` VARCHAR(60) NULL,
    `batchNo` VARCHAR(80) NULL,
    `mfgDate` VARCHAR(20) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `qty` DECIMAL(18, 3) NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxPct` DECIMAL(9, 2) NULL,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discPct` DECIMAL(9, 2) NULL,
    `discAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `lineValue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `purchase_invoice_items_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    INDEX `purchase_invoice_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: purchase_invoice_attachments
CREATE TABLE `purchase_invoice_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseInvoiceId` INTEGER NOT NULL,
    `docType` VARCHAR(20) NOT NULL DEFAULT 'invoice',
    `fileName` VARCHAR(200) NOT NULL,
    `fileUrl` LONGTEXT NOT NULL,
    `fileType` VARCHAR(80) NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `purchase_invoice_attachments_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: purchase_invoice_grn_mapping
CREATE TABLE `purchase_invoice_grn_mapping` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseInvoiceId` INTEGER NOT NULL,
    `grnId` INTEGER NOT NULL,
    `grnNo` VARCHAR(40) NOT NULL,
    `grnAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `purchase_invoice_grn_mapping_purchaseInvoiceId_grnId_key`(`purchaseInvoiceId`, `grnId`),
    INDEX `purchase_invoice_grn_mapping_grnId_idx`(`grnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `purchase_settings` ADD CONSTRAINT `purchase_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_invoice` ADD CONSTRAINT `purchase_invoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_invoice_attachments` ADD CONSTRAINT `purchase_invoice_attachments_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_invoice_grn_mapping` ADD CONSTRAINT `purchase_invoice_grn_mapping_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
