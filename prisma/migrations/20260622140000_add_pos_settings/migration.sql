-- POS Configuration (inventory / POS / payment toggles + tax treatment) per tenant.
CREATE TABLE `pos_settings` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `tenantId`  INT NOT NULL,
  `config`    JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `pos_settings_tenantId_key` (`tenantId`),
  CONSTRAINT `pos_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
