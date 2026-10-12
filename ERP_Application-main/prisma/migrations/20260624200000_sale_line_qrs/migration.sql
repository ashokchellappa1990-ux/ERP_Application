-- CreateTable: one scanned QR code per sale line (links qr_code_mappings -> sale_lines)
CREATE TABLE `sale_line_qrs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `saleId` INTEGER NOT NULL,
    `saleLineId` INTEGER NOT NULL,
    `qrCodeMappingId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `mode` VARCHAR(10) NOT NULL,
    `batchNo` VARCHAR(80) NULL,
    `mfgDate` VARCHAR(20) NULL,
    `expiryDate` VARCHAR(20) NULL,
    `businessId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sale_line_qrs_tenantId_code_idx`(`tenantId`, `code`),
    INDEX `sale_line_qrs_saleLineId_idx`(`saleLineId`),
    INDEX `sale_line_qrs_saleId_idx`(`saleId`),
    INDEX `sale_line_qrs_qrCodeMappingId_idx`(`qrCodeMappingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sale_line_qrs` ADD CONSTRAINT `sale_line_qrs_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sale_line_qrs` ADD CONSTRAINT `sale_line_qrs_saleLineId_fkey` FOREIGN KEY (`saleLineId`) REFERENCES `sale_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sale_line_qrs` ADD CONSTRAINT `sale_line_qrs_qrCodeMappingId_fkey` FOREIGN KEY (`qrCodeMappingId`) REFERENCES `qr_code_mappings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
