-- Receipt module: reusable non-supplier party master.
CREATE TABLE `receipt_party` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `type` VARCHAR(20) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `gstin` VARCHAR(20) NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(150) NULL,
  `address` VARCHAR(300) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `receipt_party_tenantId_type_idx`(`tenantId`, `type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
