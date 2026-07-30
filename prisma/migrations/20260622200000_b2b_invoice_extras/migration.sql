-- Customer: contact person + pincode for richer B2B customer capture.
ALTER TABLE `customers`
  ADD COLUMN `pincode`       VARCHAR(12) NULL AFTER `state`,
  ADD COLUMN `contactPerson` VARCHAR(120) NULL AFTER `pincode`;

-- Sale: sales-order reference + terms & conditions.
ALTER TABLE `sales`
  ADD COLUMN `soNumber`        VARCHAR(40) NULL AFTER `paymentTerms`,
  ADD COLUMN `termsConditions` TEXT NULL AFTER `soNumber`;

-- Attached documents for an invoice (PO copy, delivery note, etc.).
CREATE TABLE `sale_attachments` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `tenantId`  INT NOT NULL,
  `saleId`    INT NOT NULL,
  `fileName`  VARCHAR(200) NOT NULL,
  `fileUrl`   VARCHAR(400) NOT NULL,
  `fileType`  VARCHAR(80) NULL,
  `size`      INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `sale_attachments_saleId_idx` (`saleId`),
  CONSTRAINT `sale_attachments_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
