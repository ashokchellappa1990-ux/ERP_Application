-- Bank accounts can be company-level (Banking Setup → branchId null) or branch-
-- level (Branch Setup → branchId set). Both carry businessId.
ALTER TABLE `setup_banks`
  ADD COLUMN `businessId` INT NULL AFTER `setupId`,
  ADD COLUMN `branchId` INT NULL AFTER `businessId`;

CREATE INDEX `setup_banks_businessId_idx` ON `setup_banks` (`businessId`);
CREATE INDEX `setup_banks_branchId_idx` ON `setup_banks` (`branchId`);
