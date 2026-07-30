-- Multiple invoice templates per tenant by type (B2C / B2B / COLLECTION).
ALTER TABLE `invoice_templates` ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'B2C' AFTER `tenantId`;
-- Add the composite unique first (its leftmost column tenantId backs the FK)…
ALTER TABLE `invoice_templates` ADD UNIQUE INDEX `invoice_templates_tenantId_type_key` (`tenantId`, `type`);
-- …then the old single-column unique can be dropped.
ALTER TABLE `invoice_templates` DROP INDEX `invoice_templates_tenantId_key`;
