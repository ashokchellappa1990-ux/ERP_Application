-- Website CMS: config store (draft/published) + captured leads.

-- CreateTable
CREATE TABLE `website_setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `draftJson` LONGTEXT NULL,
    `publishedJson` LONGTEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_lead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(20) NOT NULL DEFAULT 'contact',
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(200) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `company` VARCHAR(200) NULL,
    `industry` VARCHAR(80) NULL,
    `plan` VARCHAR(40) NULL,
    `message` TEXT NULL,
    `source` VARCHAR(120) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'New',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `website_lead_type_idx`(`type`),
    INDEX `website_lead_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
