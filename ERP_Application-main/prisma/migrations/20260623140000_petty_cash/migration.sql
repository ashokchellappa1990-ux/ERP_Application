-- Supplier categorisation (parties live in the supplier master).
ALTER TABLE `suppliers` ADD COLUMN `category` VARCHAR(30) NOT NULL DEFAULT 'Supplier' AFTER `paymentTerms`;
CREATE INDEX `suppliers_tenantId_category_idx` ON `suppliers` (`tenantId`, `category`);

-- Expense category / head tree.
CREATE TABLE `expense_heads` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `parentId` INT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `expense_heads_tenantId_idx` (`tenantId`),
  INDEX `expense_heads_parentId_idx` (`parentId`),
  CONSTRAINT `expense_heads_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `expense_heads_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `expense_heads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Petty cash config.
CREATE TABLE `petty_cash_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `budgetEnabled` BOOLEAN NOT NULL DEFAULT false,
  `budgetScope` VARCHAR(10) NOT NULL DEFAULT 'all',
  `partySource` VARCHAR(10) NOT NULL DEFAULT 'both',
  `voucherPrefix` VARCHAR(20) NOT NULL DEFAULT 'PCV',
  `voucherPadding` INT NOT NULL DEFAULT 4,
  `voucherSeparator` VARCHAR(3) NOT NULL DEFAULT '-',
  `voucherSeq` INT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `petty_cash_config_tenantId_key` (`tenantId`),
  CONSTRAINT `petty_cash_config_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense budgets per head.
CREATE TABLE `expense_budgets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `headId` INT NOT NULL,
  `period` VARCHAR(20) NOT NULL DEFAULT 'ALL',
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `expense_budgets_tenantId_headId_period_key` (`tenantId`, `headId`, `period`),
  INDEX `expense_budgets_tenantId_idx` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Petty cash vouchers + lines + payments.
CREATE TABLE `petty_cash_vouchers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `voucherNo` VARCHAR(40) NOT NULL,
  `voucherDate` VARCHAR(20) NOT NULL,
  `payeeType` VARCHAR(20) NOT NULL,
  `payeeId` INT NULL,
  `payeeName` VARCHAR(200) NULL,
  `totalAmount` DECIMAL(18,2) NOT NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Completed',
  `createdBy` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `petty_cash_vouchers_tenantId_voucherNo_key` (`tenantId`, `voucherNo`),
  INDEX `petty_cash_vouchers_tenantId_voucherDate_idx` (`tenantId`, `voucherDate`),
  CONSTRAINT `petty_cash_vouchers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_lines` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `voucherId` INT NOT NULL,
  `headId` INT NULL,
  `headName` VARCHAR(160) NULL,
  `description` VARCHAR(300) NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `petty_cash_lines_voucherId_idx` (`voucherId`),
  INDEX `petty_cash_lines_tenantId_headId_idx` (`tenantId`, `headId`),
  CONSTRAINT `petty_cash_lines_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `petty_cash_vouchers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `voucherId` INT NOT NULL,
  `mode` VARCHAR(40) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `reference` VARCHAR(80) NULL,
  PRIMARY KEY (`id`),
  INDEX `petty_cash_payments_voucherId_idx` (`voucherId`),
  CONSTRAINT `petty_cash_payments_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `petty_cash_vouchers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
