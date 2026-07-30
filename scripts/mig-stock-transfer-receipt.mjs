// Stock Transfer Receipt — the destination branch acknowledges receipt of dispatched
// stock. Moves In-Transit → destination real warehouse (accepted) / Damage/Quarantine
// (damaged), writes the ledger and posts internal accounting (Inventory Dr / In-Transit Cr).
//   node --env-file=.env scripts/mig-stock-transfer-receipt.mjs
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
  await run(`CREATE TABLE IF NOT EXISTS stock_transfer_receipt (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    receiptNo VARCHAR(40) NOT NULL,
    receiptDate VARCHAR(20) NOT NULL,
    dispatchId INT NOT NULL,
    dispatchNo VARCHAR(40) NULL,
    dispatchDate VARCHAR(20) NULL,
    sourceBranchId INT NOT NULL,
    destinationBranchId INT NOT NULL,
    destinationWarehouse VARCHAR(120) NULL,
    vehicleNo VARCHAR(40) NULL,
    driverName VARCHAR(120) NULL,
    transportName VARCHAR(120) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'Draft',
    approvalStatus VARCHAR(16) NOT NULL DEFAULT 'NotRequired',
    remarks TEXT NULL,
    totalItems INT NOT NULL DEFAULT 0,
    totalReceivedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalAcceptedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalDamagedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalMissingQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdBy INT NULL,
    createdByName VARCHAR(160) NULL,
    receivedBy INT NULL,
    receivedByName VARCHAR(160) NULL,
    submittedBy INT NULL,
    submittedAt DATETIME NULL,
    approvedBy INT NULL,
    approvedByName VARCHAR(160) NULL,
    approvedAt DATETIME NULL,
    rejectedBy INT NULL,
    rejectReason VARCHAR(300) NULL,
    completedAt DATETIME NULL,
    returnedAt DATETIME NULL,
    lockedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rcpt_no (tenantId, receiptNo),
    KEY idx_rcpt_status (tenantId, status),
    KEY idx_rcpt_disp (dispatchId),
    KEY idx_rcpt_dest (tenantId, destinationBranchId),
    KEY idx_rcpt_date (tenantId, businessId, receiptDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS stock_transfer_receipt_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    receiptId INT NOT NULL,
    dispatchItemId INT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    uom VARCHAR(20) NULL,
    batchNo VARCHAR(80) NULL,
    mfgDate VARCHAR(20) NULL,
    expiryDate VARCHAR(20) NULL,
    serials TEXT NULL,
    dispatchQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    receivedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    missingQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    damagedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    acceptedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    purchasePrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    sellingPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    mrp DECIMAL(18,2) NOT NULL DEFAULT 0,
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rcpt_item_hdr FOREIGN KEY (receiptId) REFERENCES stock_transfer_receipt(id) ON DELETE CASCADE,
    KEY idx_rcpt_item_hdr (receiptId),
    KEY idx_rcpt_item_prod (tenantId, productId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("✓ stock_transfer_receipt, stock_transfer_receipt_items ready");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
