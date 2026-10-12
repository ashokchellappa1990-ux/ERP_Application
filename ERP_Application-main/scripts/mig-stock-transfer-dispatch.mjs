// Stock Transfer Dispatch — physically moves inventory between branches. Reduces the
// dispatching branch's stock, creates in-transit stock at the receiving branch, writes
// the stock ledger and posts ONLY internal-movement accounting (In-Transit Dr / Inventory Cr).
//   node --env-file=.env scripts/mig-stock-transfer-dispatch.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});
async function run(sql) { const c = await pool.getConnection(); try { await c.query(sql); } finally { c.release(); } }

async function main() {
  await run(`CREATE TABLE IF NOT EXISTS stock_transfer_dispatch (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    dispatchNo VARCHAR(40) NOT NULL,
    dispatchDate VARCHAR(20) NOT NULL,
    dispatchType VARCHAR(24) NOT NULL DEFAULT 'Transfer Request Based',
    referenceType VARCHAR(30) NULL,
    referenceId INT NULL,
    referenceNo VARCHAR(40) NULL,
    allocationId INT NULL,
    sourceBranchId INT NOT NULL,
    sourceWarehouse VARCHAR(120) NULL,
    destinationBranchId INT NOT NULL,
    destinationWarehouse VARCHAR(120) NULL,
    vehicleNo VARCHAR(40) NULL,
    driverName VARCHAR(120) NULL,
    transportName VARCHAR(120) NULL,
    lrNumber VARCHAR(60) NULL,
    expectedDeliveryDate VARCHAR(20) NULL,
    priority VARCHAR(12) NOT NULL DEFAULT 'Normal',
    status VARCHAR(24) NOT NULL DEFAULT 'Draft',
    approvalStatus VARCHAR(16) NOT NULL DEFAULT 'NotRequired',
    remarks TEXT NULL,
    totalItems INT NOT NULL DEFAULT 0,
    totalDispatchQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    challanNo VARCHAR(40) NULL,
    challanGeneratedAt DATETIME NULL,
    createdBy INT NULL,
    createdByName VARCHAR(160) NULL,
    submittedBy INT NULL,
    submittedAt DATETIME NULL,
    approvedBy INT NULL,
    approvedByName VARCHAR(160) NULL,
    approvedAt DATETIME NULL,
    rejectedBy INT NULL,
    rejectReason VARCHAR(300) NULL,
    dispatchedAt DATETIME NULL,
    returnedAt DATETIME NULL,
    lockedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_disp_no (tenantId, dispatchNo),
    KEY idx_disp_status (tenantId, status),
    KEY idx_disp_ref (referenceType, referenceId),
    KEY idx_disp_src (tenantId, sourceBranchId),
    KEY idx_disp_date (tenantId, businessId, dispatchDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS stock_transfer_dispatch_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    dispatchId INT NOT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    uom VARCHAR(20) NULL,
    batchNo VARCHAR(80) NULL,
    mfgDate VARCHAR(20) NULL,
    expiryDate VARCHAR(20) NULL,
    serials TEXT NULL,
    zoneId INT NULL,
    rackId INT NULL,
    shelfId INT NULL,
    binId INT NULL,
    availableQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    requestedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    allocatedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    pickedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    dispatchQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    unitCost DECIMAL(18,2) NOT NULL DEFAULT 0,
    stockValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_disp_item_hdr FOREIGN KEY (dispatchId) REFERENCES stock_transfer_dispatch(id) ON DELETE CASCADE,
    KEY idx_disp_item_hdr (dispatchId),
    KEY idx_disp_item_prod (tenantId, productId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("✓ stock_transfer_dispatch, stock_transfer_dispatch_items ready");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
