-- Rename inventory rate/value columns to purchaseRate/purchaseValue and add
-- sellingRate / sellingValue so the DB itself carries both purchase and selling
-- figures (previously these were UI-only labels / computed values).

-- inventory_ledger: rate -> purchaseRate, value -> purchaseValue, add selling columns
ALTER TABLE `inventory_ledger`
  CHANGE COLUMN `rate` `purchaseRate` DECIMAL(18,2) NULL,
  CHANGE COLUMN `value` `purchaseValue` DECIMAL(18,2) NULL,
  ADD COLUMN `sellingRate` DECIMAL(18,2) NULL AFTER `purchaseRate`,
  ADD COLUMN `sellingValue` DECIMAL(18,2) NULL AFTER `purchaseValue`;

-- inventory_balances: unitRate -> purchaseRate, value -> purchaseValue, add sellingValue
ALTER TABLE `inventory_balances`
  CHANGE COLUMN `unitRate` `purchaseRate` DECIMAL(18,2) NULL,
  CHANGE COLUMN `value` `purchaseValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `sellingValue` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `purchaseValue`;
UPDATE `inventory_balances` SET `sellingValue` = ROUND(`qtyOnHand` * COALESCE(`sellingRate`, 0), 2);

-- inventory_lots: unitRate -> purchaseRate, value -> purchaseValue, add sellingValue
ALTER TABLE `inventory_lots`
  CHANGE COLUMN `unitRate` `purchaseRate` DECIMAL(18,2) NULL,
  CHANGE COLUMN `value` `purchaseValue` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `sellingValue` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `purchaseValue`;
UPDATE `inventory_lots` SET `sellingValue` = ROUND(`qtyOnHand` * COALESCE(`sellingRate`, 0), 2);

-- Backfill ledger selling figures from current lot/balance selling rate where possible.
UPDATE `inventory_ledger` l
  JOIN `inventory_balances` b ON b.tenantId = l.tenantId AND b.productId = l.productId
  SET l.`sellingRate` = b.`sellingRate`,
      l.`sellingValue` = ROUND(l.`qty` * COALESCE(b.`sellingRate`, 0), 2)
  WHERE l.`sellingRate` IS NULL AND b.`sellingRate` IS NOT NULL;
