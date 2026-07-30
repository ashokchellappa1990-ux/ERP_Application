-- Day opening can be branch-level (no terminal) when terminal-based setup is off
-- or the user isn't mapped to a terminal.
ALTER TABLE `day_opening` MODIFY COLUMN `terminalId` INTEGER NULL;
