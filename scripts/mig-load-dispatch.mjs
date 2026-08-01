// Load & Dispatch — the single warehouse execution screen that absorbs the old
// Dispatch Execution + Loading Confirmation screens into one full-page flow.
// Stock Transfer Dispatch stays as a backing engine (postDispatch, called at
// completion) but is no longer a user-facing screen — Load & Dispatch creates
// its StockTransferDispatch row internally when the source is Stock Transfer.
//   node --env-file=.env scripts/mig-load-dispatch.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  connectionLimit: 4,
});
async function run(sql) { const c = await pool.getConnection(); try { await c.query(sql); } finally { c.release(); } }
async function columnExists(table, col) {
  const c = await pool.getConnection();
  try {
    const rows = await c.query(`SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, col]);
    return Number(rows[0].n) > 0;
  } finally { c.release(); }
}
async function addColumn(table, col, ddl) {
  if (await columnExists(table, col)) { console.log(`  · ${table}.${col} already exists, skipping`); return; }
  await run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`  ✓ ${table}.${col} added`);
}

async function main() {
  await run(`CREATE TABLE IF NOT EXISTS load_dispatch (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    warehouse VARCHAR(120) NULL,
    dispatchNo VARCHAR(40) NOT NULL,
    dispatchDate VARCHAR(20) NOT NULL,
    docType VARCHAR(24) NOT NULL DEFAULT 'Customer',
    sourceRefType VARCHAR(30) NULL,
    sourceRefId INT NULL,
    sourceRefNo VARCHAR(60) NULL,
    partyType VARCHAR(20) NULL,
    partyId INT NULL,
    partyName VARCHAR(200) NULL,
    deliveryAddress VARCHAR(400) NULL,
    destinationWarehouse VARCHAR(120) NULL,
    vehicleGateEntryId INT NULL,
    transportCompanyId INT NULL,
    vehicleId INT NULL,
    vehicleType VARCHAR(60) NULL,
    driverName VARCHAR(150) NULL,
    driverMobile VARCHAR(20) NULL,
    driverLicenseNo VARCHAR(60) NULL,
    helperName VARCHAR(150) NULL,
    helperMobile VARCHAR(20) NULL,
    routeId INT NULL,
    sealNumber VARCHAR(60) NULL,
    trailerNumber VARCHAR(40) NULL,
    containerNumber VARCHAR(40) NULL,
    loadingBayId INT NULL,
    supervisor VARCHAR(160) NULL,
    loadingStart DATETIME NULL,
    loadingEnd DATETIME NULL,
    packages INT NOT NULL DEFAULT 0,
    pallets INT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'Draft',
    totalProducts INT NOT NULL DEFAULT 0,
    totalQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalWeight DECIMAL(18,3) NULL,
    totalPackages INT NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    cancelReason VARCHAR(300) NULL,
    startedBy INT NULL,
    startedAt DATETIME NULL,
    completedBy INT NULL,
    completedAt DATETIME NULL,
    deliveryChallanId INT NULL,
    saleId INT NULL,
    approvedBy INT NULL,
    createdBy INT NULL,
    createdByName VARCHAR(160) NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_load_dispatch_no (tenantId, dispatchNo),
    KEY idx_load_dispatch_status (tenantId, docType, status),
    KEY idx_load_dispatch_source (sourceRefType, sourceRefId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS load_dispatch_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    loadDispatchId INT NOT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    uom VARCHAR(20) NULL,
    batchNo VARCHAR(80) NULL,
    mfgDate VARCHAR(20) NULL,
    expiryDate VARCHAR(20) NULL,
    serialNo VARCHAR(120) NULL,
    allocationLotId INT NULL,
    allocatedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    dispatchedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    pendingQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    rate DECIMAL(18,2) NULL,
    value DECIMAL(18,2) NOT NULL DEFAULT 0,
    weight DECIMAL(18,3) NULL,
    qrCode VARCHAR(80) NULL,
    remarks VARCHAR(300) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    CONSTRAINT fk_load_dispatch_item_hdr FOREIGN KEY (loadDispatchId) REFERENCES load_dispatch(id) ON DELETE CASCADE,
    KEY idx_load_dispatch_item_hdr (loadDispatchId),
    KEY idx_load_dispatch_item_prod (tenantId, productId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ load_dispatch, load_dispatch_items ready");

  // Additive linkage — reuse the existing transport_cost / delivery_challan
  // tables rather than creating new ones. dispatchExecutionId was NOT NULL;
  // Load & Dispatch rows have no dispatchExecutionId at all, so it must become
  // nullable (no production rows exist yet on either table, safe to relax).
  await run(`ALTER TABLE transport_cost MODIFY COLUMN dispatchExecutionId INT NULL`);
  await run(`ALTER TABLE delivery_challan MODIFY COLUMN dispatchExecutionId INT NULL`);
  console.log("✓ dispatchExecutionId relaxed to nullable on transport_cost, delivery_challan");
  await addColumn("load_dispatch", "stockTransferDispatchId", "stockTransferDispatchId INT NULL");
  await addColumn("transport_cost", "loadDispatchId", "loadDispatchId INT NULL");
  await run(`
    ALTER TABLE transport_cost
    ADD CONSTRAINT uq_transport_cost_load_dispatch UNIQUE (loadDispatchId)
  `).catch((e) => { if (!/Duplicate key name|already exists/i.test(String(e.message))) throw e; console.log("  · uq_transport_cost_load_dispatch already exists, skipping"); });
  await addColumn("delivery_challan", "loadDispatchId", "loadDispatchId INT NULL");
  console.log("✓ transport_cost.loadDispatchId, delivery_challan.loadDispatchId ready");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
