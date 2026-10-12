-- A user's home business + branch (the scope they operate in by default). Lets
-- getActiveScope() segregate each user to their assigned business/branch.
ALTER TABLE `users`
  ADD COLUMN `businessId` INT NULL AFTER `tenantId`,
  ADD COLUMN `branchId` INT NULL AFTER `businessId`;

-- Backfill existing users to their tenant's default business + default branch.
UPDATE `users` u JOIN `businesses` b ON b.`tenantId` = u.`tenantId` AND b.`isDefault` = true SET u.`businessId` = b.`id`;
UPDATE `users` u JOIN `branches` br ON br.`tenantId` = u.`tenantId` AND br.`isDefault` = true SET u.`branchId` = br.`id`;

CREATE INDEX `users_businessId_idx` ON `users` (`businessId`);
CREATE INDEX `users_branchId_idx` ON `users` (`branchId`);
