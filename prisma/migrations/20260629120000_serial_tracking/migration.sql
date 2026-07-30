-- Serial Number Management: extend the per-piece QR mapping into the serial registry.
ALTER TABLE `qr_code_mappings`
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  ADD COLUMN `warehouse` VARCHAR(120) NULL,
  ADD COLUMN `grnId` INTEGER NULL,
  ADD COLUMN `serialNo` VARCHAR(120) NULL,
  ADD COLUMN `soldInvoiceNo` VARCHAR(40) NULL,
  ADD COLUMN `customerId` INTEGER NULL,
  ADD COLUMN `customerName` VARCHAR(200) NULL,
  ADD COLUMN `warrantyStart` VARCHAR(20) NULL,
  ADD COLUMN `warrantyEnd` VARCHAR(20) NULL,
  ADD COLUMN `activatedAt` DATETIME(3) NULL,
  ADD COLUMN `notes` VARCHAR(300) NULL;

CREATE INDEX `qr_code_mappings_tenantId_serialNo_idx` ON `qr_code_mappings`(`tenantId`, `serialNo`);
