-- B2B sales invoice fields on the shared sales table.
ALTER TABLE `sales`
  ADD COLUMN `customerGstin` VARCHAR(20) NULL AFTER `customerPhone`,
  ADD COLUMN `dueDate`       VARCHAR(20) NULL AFTER `warehouse`,
  ADD COLUMN `paymentTerms`  VARCHAR(120) NULL AFTER `dueDate`;
