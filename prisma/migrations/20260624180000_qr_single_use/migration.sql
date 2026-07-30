-- Unique QR single-use control: mark a code Sold so it can't be scanned/sold again.
ALTER TABLE `qr_code_mappings` ADD COLUMN `status` VARCHAR(10) NOT NULL DEFAULT 'Active';
ALTER TABLE `qr_code_mappings` ADD COLUMN `soldSaleId` INT NULL;
ALTER TABLE `qr_code_mappings` ADD COLUMN `soldAt` DATETIME(3) NULL;
CREATE INDEX `qr_code_mappings_status_idx` ON `qr_code_mappings` (`status`);

-- The scanned unique QR code(s) consumed by a sale line (CSV audit).
ALTER TABLE `sale_lines` ADD COLUMN `qrCodes` TEXT NULL;
