-- Branch operating hours, bank account & contact-person details (captured in
-- Business Setup → Branch Setup step).
ALTER TABLE `branches`
  ADD COLUMN `openTime` VARCHAR(10) NULL AFTER `pincode`,
  ADD COLUMN `closeTime` VARCHAR(10) NULL AFTER `openTime`,
  ADD COLUMN `bankName` VARCHAR(150) NULL AFTER `closeTime`,
  ADD COLUMN `bankAccount` VARCHAR(40) NULL AFTER `bankName`,
  ADD COLUMN `bankIfsc` VARCHAR(20) NULL AFTER `bankAccount`,
  ADD COLUMN `bankUpi` VARCHAR(60) NULL AFTER `bankIfsc`,
  ADD COLUMN `contactPerson` VARCHAR(150) NULL AFTER `bankUpi`;
