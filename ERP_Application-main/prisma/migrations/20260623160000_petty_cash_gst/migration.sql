-- Petty cash: GST-based expense + month/year voucher numbering.
ALTER TABLE `petty_cash_config`
  ADD COLUMN `gstEnabled` BOOLEAN NOT NULL DEFAULT false AFTER `partySource`,
  ADD COLUMN `voucherIncludeYear` BOOLEAN NOT NULL DEFAULT false AFTER `voucherSeparator`,
  ADD COLUMN `voucherIncludeMonth` BOOLEAN NOT NULL DEFAULT false AFTER `voucherIncludeYear`,
  ADD COLUMN `voucherYearFormat` VARCHAR(20) NOT NULL DEFAULT 'fy_short' AFTER `voucherIncludeMonth`,
  ADD COLUMN `voucherResetFrequency` VARCHAR(20) NOT NULL DEFAULT 'never' AFTER `voucherYearFormat`,
  ADD COLUMN `voucherSeqPeriod` VARCHAR(20) NULL AFTER `voucherSeq`;

ALTER TABLE `petty_cash_vouchers`
  ADD COLUMN `gstApplicable` BOOLEAN NOT NULL DEFAULT false AFTER `payeeName`,
  ADD COLUMN `taxableTotal` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `gstApplicable`,
  ADD COLUMN `cgst` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `taxableTotal`,
  ADD COLUMN `sgst` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `cgst`,
  ADD COLUMN `taxTotal` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `sgst`;

ALTER TABLE `petty_cash_lines`
  ADD COLUMN `hsn` VARCHAR(20) NULL AFTER `description`,
  ADD COLUMN `gstPct` DECIMAL(9,2) NULL AFTER `hsn`,
  ADD COLUMN `taxable` DECIMAL(18,2) NULL AFTER `gstPct`,
  ADD COLUMN `taxAmount` DECIMAL(18,2) NULL AFTER `taxable`;
