-- =============================================================================
-- Tenant -> Business -> Branch hierarchy + data segregation rollout.
-- A tenant (subscriber account) owns 1..N businesses (GST/PAN entities); each
-- business owns 1..N branches (locations). Every transactional table gains
-- businessId + branchId, backfilled to each tenant's default business/branch so
-- existing rows stay valid. New writes scope by the active business/branch.
-- =============================================================================

-- 1. Business (legal entity under a tenant)
CREATE TABLE `businesses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `legalName` VARCHAR(200) NULL,
  `gstNumber` VARCHAR(20) NULL,
  `pan` VARCHAR(15) NULL,
  `logoUrl` LONGTEXT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `businesses_tenantId_idx` (`tenantId`),
  CONSTRAINT `businesses_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Branch (location under a business)
CREATE TABLE `branches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `businessId` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `type` VARCHAR(40) NOT NULL DEFAULT 'Retail Outlet',
  `manager` VARCHAR(150) NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(150) NULL,
  `gstin` VARCHAR(20) NULL,
  `address` VARCHAR(300) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pincode` VARCHAR(12) NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `branches_tenantId_idx` (`tenantId`),
  INDEX `branches_businessId_idx` (`businessId`),
  CONSTRAINT `branches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `branches_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Backfill: one default business per existing tenant (named after the tenant)
INSERT INTO `businesses` (`tenantId`, `name`, `isDefault`, `status`, `updatedAt`)
  SELECT `id`, `name`, true, 'active', NOW(3) FROM `tenants`;

-- 4. Backfill: one default branch per business
INSERT INTO `branches` (`tenantId`, `businessId`, `name`, `code`, `type`, `isDefault`, `status`, `updatedAt`)
  SELECT `tenantId`, `id`, 'Main Branch', 'MAIN', 'Head Office', true, 'active', NOW(3) FROM `businesses`;

-- 5. company_setups links to its business
ALTER TABLE `company_setups` ADD COLUMN `businessId` INT NULL;
UPDATE `company_setups` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
CREATE INDEX `company_setups_businessId_idx` ON `company_setups` (`businessId`);

-- 6. Add + backfill businessId/branchId on every tenant-scoped transactional table

ALTER TABLE `customers` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `customers` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `customers` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `customers_seg_idx` ON `customers` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `suppliers` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `suppliers` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `suppliers` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `suppliers_seg_idx` ON `suppliers` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `products` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `products` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `products` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `products_seg_idx` ON `products` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `sales` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `sales` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `sales` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `sales_seg_idx` ON `sales` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `sale_attachments` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `sale_attachments` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `sale_attachments` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `sale_attachments_seg_idx` ON `sale_attachments` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `opening_stock` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `opening_stock` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `opening_stock` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `opening_stock_seg_idx` ON `opening_stock` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `inventory_ledger` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `inventory_ledger` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `inventory_ledger` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `inventory_ledger_seg_idx` ON `inventory_ledger` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `inventory_balances` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `inventory_balances` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `inventory_balances` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `inventory_balances_seg_idx` ON `inventory_balances` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `inventory_lots` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `inventory_lots` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `inventory_lots` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `inventory_lots_seg_idx` ON `inventory_lots` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `goods_receipt_notes` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `goods_receipt_notes` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `goods_receipt_notes` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `goods_receipt_notes_seg_idx` ON `goods_receipt_notes` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `payables` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `payables` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `payables` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `payables_seg_idx` ON `payables` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `supplier_payments` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `supplier_payments` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `supplier_payments` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `supplier_payments_seg_idx` ON `supplier_payments` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `supplier_payment_allocations` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `supplier_payment_allocations` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `supplier_payment_allocations` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `supplier_payment_allocations_seg_idx` ON `supplier_payment_allocations` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `customer_collections` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `customer_collections` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `customer_collections` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `customer_collections_seg_idx` ON `customer_collections` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `customer_collection_allocations` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `customer_collection_allocations` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `customer_collection_allocations` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `customer_collection_allocations_seg_idx` ON `customer_collection_allocations` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `journal_entries` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `journal_entries` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `journal_entries` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `journal_entries_seg_idx` ON `journal_entries` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `journal_lines` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `journal_lines` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `journal_lines` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `journal_lines_seg_idx` ON `journal_lines` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `ledger_accounts` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `ledger_accounts` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `ledger_accounts` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `ledger_accounts_seg_idx` ON `ledger_accounts` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `opening_balances` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `opening_balances` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `opening_balances` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `opening_balances_seg_idx` ON `opening_balances` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `qr_code_mappings` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `qr_code_mappings` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `qr_code_mappings` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `qr_code_mappings_seg_idx` ON `qr_code_mappings` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `master_values` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `master_values` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `master_values` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `master_values_seg_idx` ON `master_values` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `expense_heads` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `expense_heads` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `expense_heads` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `expense_heads_seg_idx` ON `expense_heads` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `expense_budgets` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `expense_budgets` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `expense_budgets` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `expense_budgets_seg_idx` ON `expense_budgets` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `financial_periods` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `financial_periods` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `financial_periods` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `financial_periods_seg_idx` ON `financial_periods` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `petty_cash_vouchers` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `petty_cash_vouchers` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `petty_cash_vouchers` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `petty_cash_vouchers_seg_idx` ON `petty_cash_vouchers` (`tenantId`, `businessId`, `branchId`);

ALTER TABLE `petty_cash_lines` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `petty_cash_lines` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `petty_cash_lines` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `petty_cash_lines_seg_idx` ON `petty_cash_lines` (`tenantId`, `businessId`, `branchId`);

-- 7. sale_payments inherits business/branch from its parent sale (no tenantId column)
ALTER TABLE `sale_payments` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `sale_payments` sp JOIN `sales` s ON s.`id` = sp.`saleId` SET sp.`businessId` = s.`businessId`, sp.`branchId` = s.`branchId`;
CREATE INDEX `sale_payments_seg_idx` ON `sale_payments` (`businessId`, `branchId`);
