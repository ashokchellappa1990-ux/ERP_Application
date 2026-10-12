-- CreateTable: tenants (the subscribing businesses)
CREATE TABLE `tenants` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `plan` VARCHAR(30) NOT NULL DEFAULT 'trial',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `trialEndsAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `maxUsers` INTEGER NOT NULL DEFAULT 3,
  `maxBranches` INTEGER NOT NULL DEFAULT 1,
  `maxProducts` INTEGER NOT NULL DEFAULT 2000,
  `modulePharmacy` BOOLEAN NOT NULL DEFAULT false,
  `moduleLoyalty` BOOLEAN NOT NULL DEFAULT false,
  `moduleEcommerce` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tenants_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed a default tenant (id=1) for all existing data
INSERT INTO `tenants` (`id`,`name`,`slug`,`plan`,`status`,`updatedAt`) VALUES (1,'Default Business','default','pro','active',CURRENT_TIMESTAMP(3));
UPDATE `tenants` SET `name` = COALESCE((SELECT `businessName` FROM `users` ORDER BY `id` ASC LIMIT 1),'Default Business') WHERE `id`=1;

-- users.tenantId
ALTER TABLE `users` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `users` ALTER COLUMN `tenantId` DROP DEFAULT;
CREATE INDEX `users_tenantId_idx` ON `users`(`tenantId`);
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- products.tenantId + composite unique
ALTER TABLE `products` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `products` ALTER COLUMN `tenantId` DROP DEFAULT;
DROP INDEX `products_code_key` ON `products`;
CREATE UNIQUE INDEX `products_tenantId_code_key` ON `products`(`tenantId`, `code`);
CREATE INDEX `products_tenantId_idx` ON `products`(`tenantId`);
ALTER TABLE `products` ADD CONSTRAINT `products_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- master_values.tenantId + composite unique
ALTER TABLE `master_values` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `master_values` ALTER COLUMN `tenantId` DROP DEFAULT;
DROP INDEX `master_values_type_value_parentId_key` ON `master_values`;
CREATE UNIQUE INDEX `master_values_tenantId_type_value_parentId_key` ON `master_values`(`tenantId`, `type`, `value`, `parentId`);
CREATE INDEX `master_values_tenantId_idx` ON `master_values`(`tenantId`);
ALTER TABLE `master_values` ADD CONSTRAINT `master_values_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- opening_stock.tenantId + composite unique
ALTER TABLE `opening_stock` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `opening_stock` ALTER COLUMN `tenantId` DROP DEFAULT;
DROP INDEX `opening_stock_docNo_key` ON `opening_stock`;
CREATE UNIQUE INDEX `opening_stock_tenantId_docNo_key` ON `opening_stock`(`tenantId`, `docNo`);
CREATE INDEX `opening_stock_tenantId_idx` ON `opening_stock`(`tenantId`);
ALTER TABLE `opening_stock` ADD CONSTRAINT `opening_stock_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- company_setups.tenantId
ALTER TABLE `company_setups` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `company_setups` ALTER COLUMN `tenantId` DROP DEFAULT;
CREATE INDEX `company_setups_tenantId_idx` ON `company_setups`(`tenantId`);
ALTER TABLE `company_setups` ADD CONSTRAINT `company_setups_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- qr_code_settings: from global singleton to per-tenant
ALTER TABLE `qr_code_settings` ADD COLUMN `tenantId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `qr_code_settings` MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT;
ALTER TABLE `qr_code_settings` ALTER COLUMN `tenantId` DROP DEFAULT;
UPDATE `qr_code_settings` SET `tenantId`=1 WHERE `id`=1;
CREATE UNIQUE INDEX `qr_code_settings_tenantId_key` ON `qr_code_settings`(`tenantId`);
ALTER TABLE `qr_code_settings` ADD CONSTRAINT `qr_code_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
