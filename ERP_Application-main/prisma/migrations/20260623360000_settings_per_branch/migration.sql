-- Settings become per-branch: add business/branch, backfill existing rows to
-- the default business, swap the tenantId unique for a (tenant,business,branch) one.

ALTER TABLE `general_settings` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `general_settings` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
CREATE UNIQUE INDEX `general_settings_tenantId_businessId_branchId_key` ON `general_settings` (`tenantId`, `businessId`, `branchId`);
DROP INDEX `general_settings_tenantId_key` ON `general_settings`;

ALTER TABLE `sales_settings` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `sales_settings` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
CREATE UNIQUE INDEX `sales_settings_tenantId_businessId_branchId_key` ON `sales_settings` (`tenantId`, `businessId`, `branchId`);
DROP INDEX `sales_settings_tenantId_key` ON `sales_settings`;

ALTER TABLE `pos_settings` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `pos_settings` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
CREATE UNIQUE INDEX `pos_settings_tenantId_businessId_branchId_key` ON `pos_settings` (`tenantId`, `businessId`, `branchId`);
DROP INDEX `pos_settings_tenantId_key` ON `pos_settings`;

ALTER TABLE `theme_settings` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `theme_settings` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
CREATE UNIQUE INDEX `theme_settings_tenantId_businessId_branchId_key` ON `theme_settings` (`tenantId`, `businessId`, `branchId`);
DROP INDEX `theme_settings_tenantId_key` ON `theme_settings`;

ALTER TABLE `qr_code_settings` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `qr_code_settings` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
CREATE UNIQUE INDEX `qr_code_settings_tenantId_businessId_branchId_key` ON `qr_code_settings` (`tenantId`, `businessId`, `branchId`);
DROP INDEX `qr_code_settings_tenantId_key` ON `qr_code_settings`;
