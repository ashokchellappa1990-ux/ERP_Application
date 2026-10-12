-- Sales rule-engine configuration + invoice running-number counters (per tenant).
CREATE TABLE `sales_settings` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `tenantId`  INT NOT NULL,
  `config`    JSON NOT NULL,
  `seqB2c`    INT NOT NULL DEFAULT 0,
  `seqB2b`    INT NOT NULL DEFAULT 0,
  `seqPeriod` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sales_settings_tenantId_key` (`tenantId`),
  CONSTRAINT `sales_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
