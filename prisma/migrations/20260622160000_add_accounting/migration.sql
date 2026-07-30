-- Double-entry accounting: chart of accounts + journal vouchers + lines.
CREATE TABLE `ledger_accounts` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `tenantId`      INT NOT NULL,
  `code`          VARCHAR(20) NOT NULL,
  `name`          VARCHAR(120) NOT NULL,
  `type`          VARCHAR(20) NOT NULL,
  `group`         VARCHAR(60) NULL,
  `normalBalance` VARCHAR(6) NOT NULL,
  `isSystem`      BOOLEAN NOT NULL DEFAULT false,
  `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ledger_accounts_tenantId_code_key` (`tenantId`, `code`),
  INDEX `ledger_accounts_tenantId_type_idx` (`tenantId`, `type`),
  CONSTRAINT `ledger_accounts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `journal_entries` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `tenantId`    INT NOT NULL,
  `voucherNo`   VARCHAR(40) NOT NULL,
  `voucherType` VARCHAR(20) NOT NULL,
  `date`        VARCHAR(20) NOT NULL,
  `narration`   VARCHAR(300) NULL,
  `sourceType`  VARCHAR(20) NULL,
  `sourceId`    INT NULL,
  `refNo`       VARCHAR(40) NULL,
  `totalDebit`  DECIMAL(18,2) NOT NULL DEFAULT 0,
  `totalCredit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `status`      VARCHAR(12) NOT NULL DEFAULT 'Posted',
  `createdBy`   INT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `journal_entries_tenantId_voucherNo_key` (`tenantId`, `voucherNo`),
  INDEX `journal_entries_tenantId_voucherType_idx` (`tenantId`, `voucherType`),
  INDEX `journal_entries_tenantId_date_idx` (`tenantId`, `date`),
  INDEX `journal_entries_sourceType_sourceId_idx` (`sourceType`, `sourceId`),
  CONSTRAINT `journal_entries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `journal_lines` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `tenantId`  INT NOT NULL,
  `journalId` INT NOT NULL,
  `accountId` INT NOT NULL,
  `debit`     DECIMAL(18,2) NOT NULL DEFAULT 0,
  `credit`    DECIMAL(18,2) NOT NULL DEFAULT 0,
  `narration` VARCHAR(300) NULL,
  PRIMARY KEY (`id`),
  INDEX `journal_lines_tenantId_accountId_idx` (`tenantId`, `accountId`),
  INDEX `journal_lines_journalId_idx` (`journalId`),
  CONSTRAINT `journal_lines_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `journal_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ledger_accounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
