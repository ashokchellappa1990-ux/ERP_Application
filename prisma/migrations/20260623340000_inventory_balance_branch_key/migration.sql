-- Stock is now per-branch: the balance is unique per (tenant, branch, product,
-- warehouse) instead of (tenant, product, warehouse). Add the new unique first,
-- then drop the old one so there's never a window without a uniqueness guard.
CREATE UNIQUE INDEX `inventory_balances_tenantId_branchId_productId_warehouse_key`
  ON `inventory_balances` (`tenantId`, `branchId`, `productId`, `warehouse`);
DROP INDEX `inventory_balances_tenantId_productId_warehouse_key` ON `inventory_balances`;
