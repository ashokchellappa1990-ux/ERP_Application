-- Drop old flat unique, add hierarchy (parentId) for Category → Sub-category → Group.
DROP INDEX `master_values_type_value_key` ON `master_values`;

ALTER TABLE `master_values` ADD COLUMN `parentId` INTEGER NULL;

CREATE UNIQUE INDEX `master_values_type_value_parentId_key` ON `master_values`(`type`, `value`, `parentId`);

CREATE INDEX `master_values_parentId_idx` ON `master_values`(`parentId`);

ALTER TABLE `master_values` ADD CONSTRAINT `master_values_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `master_values`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
