-- Customer: DOB + anniversary
ALTER TABLE `customers`
  ADD COLUMN `dob` VARCHAR(20) NULL AFTER `gstin`,
  ADD COLUMN `anniversary` VARCHAR(20) NULL AFTER `dob`;

-- CreateTable: invoice_templates (POS receipt config)
CREATE TABLE `invoice_templates` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `title` VARCHAR(60) NOT NULL DEFAULT 'Tax Invoice',
  `paperSize` VARCHAR(10) NOT NULL DEFAULT '80mm',
  `headerNote` VARCHAR(200) NULL,
  `thankYouMessage` VARCHAR(200) NOT NULL DEFAULT 'Thank you! Visit again.',
  `footerNote` VARCHAR(300) NULL,
  `showGstin` BOOLEAN NOT NULL DEFAULT true,
  `showCustomer` BOOLEAN NOT NULL DEFAULT true,
  `showHsn` BOOLEAN NOT NULL DEFAULT false,
  `showMrp` BOOLEAN NOT NULL DEFAULT true,
  `showSavings` BOOLEAN NOT NULL DEFAULT true,
  `showTaxBreakup` BOOLEAN NOT NULL DEFAULT true,
  `showItemTax` BOOLEAN NOT NULL DEFAULT false,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `invoice_templates_tenantId_key`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `invoice_templates` ADD CONSTRAINT `invoice_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
