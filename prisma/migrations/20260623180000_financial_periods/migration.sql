-- Accounting periods with the open → soft-close → lock → audit-lock workflow.
CREATE TABLE `financial_periods` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `fy` VARCHAR(20) NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'Monthly',
  `fromDate` VARCHAR(20) NOT NULL,
  `toDate` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Open',
  `createdBy` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `financial_periods_tenantId_name_key` (`tenantId`, `name`),
  INDEX `financial_periods_tenantId_fromDate_idx` (`tenantId`, `fromDate`),
  CONSTRAINT `financial_periods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
