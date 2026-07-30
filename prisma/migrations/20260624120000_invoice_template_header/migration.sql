-- Invoice template header identity options
ALTER TABLE `invoice_templates` ADD COLUMN `useBranchDetails` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `invoice_templates` ADD COLUMN `showBranchName` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `invoice_templates` ADD COLUMN `showContact` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `invoice_templates` ADD COLUMN `contactNumber` VARCHAR(40) NULL;
