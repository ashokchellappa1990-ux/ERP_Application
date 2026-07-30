ALTER TABLE `inventory_balances` ADD COLUMN `sellingRate` DECIMAL(18,2) NULL AFTER `unitRate`;
ALTER TABLE `inventory_lots` ADD COLUMN `sellingRate` DECIMAL(18,2) NULL AFTER `unitRate`;

-- Backfill lot selling rates from their source line.
UPDATE `inventory_lots` l JOIN `goods_receipt_lines` grl ON grl.`id` = l.`refId` SET l.`sellingRate` = grl.`sellingPrice` WHERE l.`refType` = 'GRN' AND grl.`sellingPrice` IS NOT NULL;
UPDATE `inventory_lots` l JOIN `opening_stock_lines` osl ON osl.`id` = l.`refId` SET l.`sellingRate` = osl.`mrp` WHERE l.`refType` = 'OPENING' AND osl.`mrp` IS NOT NULL;

-- Backfill balance selling rate from the latest lot that has one.
UPDATE `inventory_balances` b
SET b.`sellingRate` = (
  SELECT lt.`sellingRate` FROM `inventory_lots` lt
  WHERE lt.`tenantId` = b.`tenantId` AND lt.`productId` = b.`productId` AND lt.`warehouse` = b.`warehouse` AND lt.`sellingRate` IS NOT NULL
  ORDER BY lt.`id` DESC LIMIT 1
);
