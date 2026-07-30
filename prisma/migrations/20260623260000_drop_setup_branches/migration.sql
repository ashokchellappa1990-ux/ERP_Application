-- Branches now live in the `branches` table (captured in Business Setup), so the
-- legacy per-setup `setup_branches` table is no longer used. Drop it.
DROP TABLE IF EXISTS `setup_branches`;
