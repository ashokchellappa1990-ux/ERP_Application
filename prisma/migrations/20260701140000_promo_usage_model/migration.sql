-- Promo usage model: Same Code (once per customer) vs Different Codes (unique per customer).
ALTER TABLE `promo_configuration` ADD COLUMN `codeModel` VARCHAR(16) NOT NULL DEFAULT 'SameCode';
ALTER TABLE `promo_code_master` ADD COLUMN `oncePerCustomer` BOOLEAN NOT NULL DEFAULT false;
