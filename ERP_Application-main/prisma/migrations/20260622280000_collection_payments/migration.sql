-- Split-tender breakdown for a customer collection.
ALTER TABLE `customer_collections` ADD COLUMN `payments` JSON NULL AFTER `attachments`;
