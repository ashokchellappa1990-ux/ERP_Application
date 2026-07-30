-- Customer collections + allocations (settling credit invoices; posts a RECEIPT voucher).
CREATE TABLE `customer_collections` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `tenantId`       INT NOT NULL,
  `collectionNo`   VARCHAR(40) NOT NULL,
  `customerId`     INT NULL,
  `customerName`   VARCHAR(200) NULL,
  `collectionDate` VARCHAR(20) NOT NULL,
  `mode`           VARCHAR(40) NOT NULL,
  `reference`      VARCHAR(80) NULL,
  `totalAmount`    DECIMAL(18,2) NOT NULL,
  `notes`          TEXT NULL,
  `attachments`    JSON NULL,
  `status`         VARCHAR(20) NOT NULL DEFAULT 'Completed',
  `createdBy`      INT NULL,
  `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `customer_collections_tenantId_collectionNo_key` (`tenantId`, `collectionNo`),
  INDEX `customer_collections_tenantId_collectionDate_idx` (`tenantId`, `collectionDate`),
  CONSTRAINT `customer_collections_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_collection_allocations` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `tenantId`     INT NOT NULL,
  `collectionId` INT NOT NULL,
  `saleId`       INT NOT NULL,
  `invoiceNo`    VARCHAR(40) NULL,
  `amount`       DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `customer_collection_allocations_collectionId_idx` (`collectionId`),
  INDEX `customer_collection_allocations_tenantId_saleId_idx` (`tenantId`, `saleId`),
  CONSTRAINT `customer_collection_allocations_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `customer_collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
