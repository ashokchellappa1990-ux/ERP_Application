-- Promo distribution: audience segment + campaign message content + banner image.
ALTER TABLE `promo_distribution`
  ADD COLUMN `audience` VARCHAR(20) NULL,
  ADD COLUMN `recipientCount` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `messageBody` TEXT NULL,
  ADD COLUMN `bannerImage` LONGTEXT NULL;
