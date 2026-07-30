-- Product vertical/industry
ALTER TABLE `products` ADD COLUMN `industry` VARCHAR(40) NULL;

-- QR code mapping carries batch/mfg/expiry so a scanned QR resolves its batch
ALTER TABLE `qr_code_mappings` ADD COLUMN `batchNo` VARCHAR(80) NULL;
ALTER TABLE `qr_code_mappings` ADD COLUMN `mfgDate` VARCHAR(20) NULL;
ALTER TABLE `qr_code_mappings` ADD COLUMN `expiryDate` VARCHAR(20) NULL;

-- Inventory ledger + lot keep mfg date alongside batch & expiry
ALTER TABLE `inventory_ledger` ADD COLUMN `mfgDate` VARCHAR(20) NULL;
ALTER TABLE `inventory_lots` ADD COLUMN `mfgDate` VARCHAR(20) NULL;

-- Sale line stores the batch sold
ALTER TABLE `sale_lines` ADD COLUMN `batchNo` VARCHAR(80) NULL;
ALTER TABLE `sale_lines` ADD COLUMN `mfgDate` VARCHAR(20) NULL;
ALTER TABLE `sale_lines` ADD COLUMN `expiryDate` VARCHAR(20) NULL;
