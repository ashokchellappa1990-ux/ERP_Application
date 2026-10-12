-- Running counters for Purchase Return + Asset Register numbering.
ALTER TABLE `purchase_settings`
  ADD COLUMN `seqPR` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `seqAsset` INTEGER NOT NULL DEFAULT 0;
