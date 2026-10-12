/*
  Warnings:

  - You are about to drop the `product_variants` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `product_variants` DROP FOREIGN KEY `product_variants_productId_fkey`;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `barcode` VARCHAR(80) NULL,
    ADD COLUMN `parentId` INTEGER NULL;

-- DropTable
DROP TABLE `product_variants`;

-- CreateIndex
CREATE INDEX `products_parentId_idx` ON `products`(`parentId`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
