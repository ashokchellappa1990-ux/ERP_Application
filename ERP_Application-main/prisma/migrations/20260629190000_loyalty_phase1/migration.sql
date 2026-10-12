-- Customer Loyalty Program (Phase 1).

-- Customer reward roll-up columns.
ALTER TABLE `customers`
  ADD COLUMN `availableRewardPoints` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `totalRewardPointsEarned` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `totalRewardPointsRedeemed` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `totalRewardPointsExpired` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `customerGroup` VARCHAR(80) NULL;

-- Sale loyalty columns.
ALTER TABLE `sales`
  ADD COLUMN `loyaltyEarned` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `loyaltyRedeemed` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `loyaltyRedeemValue` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- Loyalty program master.
CREATE TABLE `loyalty_program` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` VARCHAR(400) NULL,
  `effectiveFrom` VARCHAR(20) NULL,
  `effectiveTo` VARCHAR(20) NULL,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Draft',
  `remarks` VARCHAR(300) NULL,
  `eligibility` VARCHAR(20) NOT NULL DEFAULT 'all',
  `eligibleGroups` VARCHAR(300) NULL,
  `applyPos` BOOLEAN NOT NULL DEFAULT true,
  `applyB2c` BOOLEAN NOT NULL DEFAULT true,
  `applyB2b` BOOLEAN NOT NULL DEFAULT false,
  `applyOnline` BOOLEAN NOT NULL DEFAULT false,
  `calcMethod` VARCHAR(20) NOT NULL DEFAULT 'amount',
  `fixedPoints` INTEGER NOT NULL DEFAULT 0,
  `amountPer` DECIMAL(18, 2) NOT NULL DEFAULT 100,
  `amountPoints` INTEGER NOT NULL DEFAULT 1,
  `percentageRate` DECIMAL(9, 2) NOT NULL DEFAULT 1,
  `minBillAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `maxPointsPerInvoice` INTEGER NULL,
  `maxDailyPoints` INTEGER NULL,
  `maxMonthlyPoints` INTEGER NULL,
  `roundOff` VARCHAR(10) NOT NULL DEFAULT 'floor',
  `redemptionEnabled` BOOLEAN NOT NULL DEFAULT true,
  `minRedeemPoints` INTEGER NOT NULL DEFAULT 0,
  `maxRedeemPoints` INTEGER NULL,
  `maxRedeemPercent` DECIMAL(9, 2) NULL,
  `maxRedeemAmount` DECIMAL(18, 2) NULL,
  `allowPartialRedeem` BOOLEAN NOT NULL DEFAULT true,
  `pointValuePoints` INTEGER NOT NULL DEFAULT 1,
  `pointValueAmount` DECIMAL(18, 4) NOT NULL DEFAULT 1,
  `validityType` VARCHAR(10) NOT NULL DEFAULT 'never',
  `validityDays` INTEGER NULL,
  `validityMonths` INTEGER NULL,
  `autoExpiry` BOOLEAN NOT NULL DEFAULT false,
  `expiryNotification` BOOLEAN NOT NULL DEFAULT false,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `loyalty_program_tenantId_code_key`(`tenantId`, `code`),
  INDEX `loyalty_program_tenantId_status_idx`(`tenantId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Per-customer balance.
CREATE TABLE `loyalty_customer_balance` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `customerId` INTEGER NOT NULL,
  `available` INTEGER NOT NULL DEFAULT 0,
  `earned` INTEGER NOT NULL DEFAULT 0,
  `redeemed` INTEGER NOT NULL DEFAULT 0,
  `expired` INTEGER NOT NULL DEFAULT 0,
  `lastTxnAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `loyalty_customer_balance_tenantId_customerId_key`(`tenantId`, `customerId`),
  INDEX `loyalty_customer_balance_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Append-only ledger.
CREATE TABLE `loyalty_transaction_ledger` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `ledgerNo` VARCHAR(40) NULL,
  `txnDate` VARCHAR(20) NOT NULL,
  `customerId` INTEGER NOT NULL,
  `programId` INTEGER NULL,
  `txnType` VARCHAR(24) NOT NULL,
  `points` INTEGER NOT NULL,
  `balanceAfter` INTEGER NOT NULL DEFAULT 0,
  `refType` VARCHAR(24) NULL,
  `refId` INTEGER NULL,
  `invoiceNo` VARCHAR(40) NULL,
  `remarks` VARCHAR(300) NULL,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `loyalty_transaction_ledger_tenantId_customerId_idx`(`tenantId`, `customerId`),
  INDEX `loyalty_transaction_ledger_tenantId_txnDate_idx`(`tenantId`, `txnDate`),
  INDEX `loyalty_transaction_ledger_tenantId_txnType_idx`(`tenantId`, `txnType`),
  INDEX `loyalty_transaction_ledger_refType_refId_idx`(`refType`, `refId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Global settings + counters.
CREATE TABLE `loyalty_settings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `businessId` INTEGER NULL,
  `branchId` INTEGER NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `defaultProgramId` INTEGER NULL,
  `config` JSON NULL,
  `seqProgram` INTEGER NOT NULL DEFAULT 0,
  `seqLedger` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `loyalty_settings_tenantId_businessId_branchId_key`(`tenantId`, `businessId`, `branchId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
