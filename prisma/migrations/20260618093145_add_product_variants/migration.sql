-- CreateTable
CREATE TABLE `product_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `label` VARCHAR(160) NULL,
    `a1Name` VARCHAR(60) NULL,
    `a1Value` VARCHAR(60) NULL,
    `a2Name` VARCHAR(60) NULL,
    `a2Value` VARCHAR(60) NULL,
    `a3Name` VARCHAR(60) NULL,
    `a3Value` VARCHAR(60) NULL,
    `sku` VARCHAR(80) NULL,
    `barcode` VARCHAR(80) NULL,
    `mrp` DECIMAL(18, 3) NULL,
    `openingStock` DECIMAL(18, 3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',

    INDEX `product_variants_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
