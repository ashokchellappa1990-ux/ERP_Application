-- Permission catalog (global), roles (per tenant) + grants, user role link.
CREATE TABLE `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(80) NOT NULL,
  `module` VARCHAR(60) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `permissions_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `description` VARCHAR(250) NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `isAllAccess` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `roles_tenantId_slug_key` (`tenantId`, `slug`),
  INDEX `roles_tenantId_idx` (`tenantId`),
  CONSTRAINT `roles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `roleId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `role_permissions_roleId_permissionId_key` (`roleId`, `permissionId`),
  INDEX `role_permissions_roleId_idx` (`roleId`),
  INDEX `role_permissions_permissionId_idx` (`permissionId`),
  CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link a user to a role.
ALTER TABLE `users` ADD COLUMN `roleId` INT NULL AFTER `branchId`;
CREATE INDEX `users_roleId_idx` ON `users` (`roleId`);
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- invoice_templates (master) gains business/branch scope + backfill.
ALTER TABLE `invoice_templates` ADD COLUMN `businessId` INT NULL, ADD COLUMN `branchId` INT NULL;
UPDATE `invoice_templates` x JOIN `businesses` b ON b.`tenantId` = x.`tenantId` AND b.`isDefault` = true SET x.`businessId` = b.`id`;
UPDATE `invoice_templates` x JOIN `branches` br ON br.`tenantId` = x.`tenantId` AND br.`isDefault` = true SET x.`branchId` = br.`id`;
CREATE INDEX `invoice_templates_seg_idx` ON `invoice_templates` (`tenantId`, `businessId`, `branchId`);
