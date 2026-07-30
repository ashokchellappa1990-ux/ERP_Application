-- Inventory valuation method (fifo | fefo | notRequired) and out-of-order batch
-- sales policy (restrict | warn) per product.
ALTER TABLE `products` ADD COLUMN `valuation` VARCHAR(20) NULL;
ALTER TABLE `products` ADD COLUMN `batchSalesPolicy` VARCHAR(20) NULL;
