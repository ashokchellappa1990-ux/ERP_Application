-- AlterTable: global "terminal-based setup required" flag
ALTER TABLE `general_settings` ADD COLUMN `terminalSetupRequired` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: user_terminal_maps (user ↔ terminal many-to-many)
CREATE TABLE `user_terminal_maps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `userId` INTEGER NOT NULL,
    `terminalId` INTEGER NOT NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `user_terminal_maps_userId_terminalId_key`(`userId`, `terminalId`),
    INDEX `user_terminal_maps_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `user_terminal_maps_tenantId_terminalId_idx`(`tenantId`, `terminalId`),
    INDEX `user_terminal_maps_terminalId_idx`(`terminalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_terminal_maps` ADD CONSTRAINT `user_terminal_maps_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_terminal_maps` ADD CONSTRAINT `user_terminal_maps_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_terminal_maps` ADD CONSTRAINT `user_terminal_maps_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `pos_terminals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
