-- Supplier payments + allocations (settling payables; posts a PAYMENT voucher).
CREATE TABLE `supplier_payments` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `tenantId`    INT NOT NULL,
  `paymentNo`   VARCHAR(40) NOT NULL,
  `supplier`    VARCHAR(200) NULL,
  `paymentDate` VARCHAR(20) NOT NULL,
  `mode`        VARCHAR(40) NOT NULL,
  `reference`   VARCHAR(80) NULL,
  `totalAmount` DECIMAL(18,2) NOT NULL,
  `notes`       TEXT NULL,
  `status`      VARCHAR(20) NOT NULL DEFAULT 'Completed',
  `createdBy`   INT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `supplier_payments_tenantId_paymentNo_key` (`tenantId`, `paymentNo`),
  INDEX `supplier_payments_tenantId_paymentDate_idx` (`tenantId`, `paymentDate`),
  CONSTRAINT `supplier_payments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supplier_payment_allocations` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `tenantId`   INT NOT NULL,
  `paymentId`  INT NOT NULL,
  `payableId`  INT NOT NULL,
  `refNo`      VARCHAR(40) NULL,
  `sourceType` VARCHAR(20) NULL,
  `sourceId`   INT NULL,
  `amount`     DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `supplier_payment_allocations_paymentId_idx` (`paymentId`),
  INDEX `supplier_payment_allocations_tenantId_payableId_idx` (`tenantId`, `payableId`),
  CONSTRAINT `supplier_payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `supplier_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
