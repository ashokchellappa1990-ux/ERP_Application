-- Button fill style + gradient controls for the application theme.
ALTER TABLE `theme_settings` ADD COLUMN `buttonStyle` VARCHAR(12) NOT NULL DEFAULT 'gradient' AFTER `accentColor`;
ALTER TABLE `theme_settings` ADD COLUMN `gradientFrom` VARCHAR(20) NULL AFTER `buttonStyle`;
ALTER TABLE `theme_settings` ADD COLUMN `gradientTo` VARCHAR(20) NULL AFTER `gradientFrom`;
ALTER TABLE `theme_settings` ADD COLUMN `gradientAngle` INT NOT NULL DEFAULT 135 AFTER `gradientTo`;
