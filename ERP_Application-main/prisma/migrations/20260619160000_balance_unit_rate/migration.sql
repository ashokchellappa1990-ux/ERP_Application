-- Inventory balance valuation switches from average rate to unit rate.
ALTER TABLE `inventory_balances` CHANGE COLUMN `avgRate` `unitRate` DECIMAL(18,2) NULL;
