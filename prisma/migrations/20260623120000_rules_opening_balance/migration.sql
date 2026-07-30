-- Accounting Rule Engine config (per tenant).
CREATE TABLE `accounting_rule_settings` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `tenantId`  INT NOT NULL,
  `config`    JSON NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `accounting_rule_settings_tenantId_key` (`tenantId`),
  CONSTRAINT `accounting_rule_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opening balances (cash in hand / cash at bank).
CREATE TABLE `opening_balances` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `tenantId`  INT NOT NULL,
  `kind`      VARCHAR(10) NOT NULL,
  `label`     VARCHAR(150) NULL,
  `bankId`    INT NULL,
  `bankName`  VARCHAR(150) NULL,
  `branch`    VARCHAR(150) NULL,
  `accountNo` VARCHAR(40) NULL,
  `ifsc`      VARCHAR(20) NULL,
  `amount`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `asOfDate`  VARCHAR(20) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `opening_balances_tenantId_idx` (`tenantId`),
  CONSTRAINT `opening_balances_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
