-- CreateTable: audit_logs (append-only audit trail)
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `userId` INTEGER NULL,
    `userName` VARCHAR(200) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(60) NULL,
    `summary` VARCHAR(300) NULL,
    `meta` TEXT NULL,
    `ip` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `audit_logs_tenantId_entity_entityId_idx`(`tenantId`, `entity`, `entityId`),
    INDEX `audit_logs_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `audit_logs_tenantId_action_idx`(`tenantId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
