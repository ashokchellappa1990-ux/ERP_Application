-- TDS / TCS on the sales invoice.
ALTER TABLE `sales`
  ADD COLUMN `tdsAmount` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `taxTotal`,
  ADD COLUMN `tcsAmount` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `tdsAmount`;
