-- Loyalty: record the ₹ value of each ledger transaction (for reports + GL) + seed accounts.
ALTER TABLE `loyalty_transaction_ledger` ADD COLUMN `value` DECIMAL(18, 2) NOT NULL DEFAULT 0;
