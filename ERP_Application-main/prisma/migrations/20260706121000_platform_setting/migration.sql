-- Platform setting table.

-- CreateTable
CREATE TABLE `platform_setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configJson` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
