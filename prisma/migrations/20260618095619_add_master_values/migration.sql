-- CreateTable
CREATE TABLE `master_values` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(40) NOT NULL,
    `value` VARCHAR(150) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `master_values_type_idx`(`type`),
    UNIQUE INDEX `master_values_type_value_key`(`type`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
