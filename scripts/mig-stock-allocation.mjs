// Stock Allocation module — reserves inventory against an approved Stock Transfer
// Request before dispatch. Reservation is tracked in stock_allocation_lots (the
// source of truth); physical inventory (inventory_balances / inventory_lots) is
// NEVER mutated here — no ledger, no accounting. Run:
//   node --env-file=.env scripts/mig-stock-allocation.mjs
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
  await run(`CREATE TABLE IF NOT EXISTS stock_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    allocationNo VARCHAR(40) NOT NULL,
    allocationDate VARCHAR(20) NOT NULL,
    requestId INT NOT NULL,
    requestNo VARCHAR(40) NOT NULL,
    sourceBranchId INT NOT NULL,
    sourceWarehouse VARCHAR(120) NULL,
    destinationBranchId INT NOT NULL,
    destinationWarehouse VARCHAR(120) NULL,
    transferType VARCHAR(40) NULL,
    priority VARCHAR(12) NOT NULL DEFAULT 'Normal',
    status VARCHAR(24) NOT NULL DEFAULT 'Draft',
    approvalStatus VARCHAR(16) NOT NULL DEFAULT 'NotRequired',
    remarks TEXT NULL,
    totalItems INT NOT NULL DEFAULT 0,
    totalRequestedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalAllocatedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    allocatedBy INT NULL,
    allocatedByName VARCHAR(160) NULL,
    allocatedAt DATETIME NULL,
    releasedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    createdBy INT NULL,
    createdByName VARCHAR(160) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_alloc_no (tenantId, allocationNo),
    KEY idx_alloc_status (tenantId, status),
    KEY idx_alloc_req (requestId),
    KEY idx_alloc_src (tenantId, sourceBranchId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS stock_allocation_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    allocationId INT NOT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    uom VARCHAR(20) NULL,
    requestedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    availableQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    reservedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    allocatedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    remainingQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    policy VARCHAR(16) NOT NULL DEFAULT 'Qty',
    allocationStatus VARCHAR(16) NOT NULL DEFAULT 'Pending',
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alloc_line_hdr FOREIGN KEY (allocationId) REFERENCES stock_allocations(id) ON DELETE CASCADE,
    KEY idx_alloc_line_hdr (allocationId),
    KEY idx_alloc_line_prod (tenantId, productId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // The reservation ledger — one row per reserved lot / serial / plain-qty bucket.
  // status Active = currently reserving stock; Released = freed; Dispatched = consumed.
  await run(`CREATE TABLE IF NOT EXISTS stock_allocation_lots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    allocationId INT NOT NULL,
    lineId INT NOT NULL,
    productId INT NOT NULL,
    branchId INT NOT NULL,
    warehouse VARCHAR(120) NULL,
    batchNo VARCHAR(80) NULL,
    mfgDate VARCHAR(20) NULL,
    expiryDate VARCHAR(20) NULL,
    serialNo VARCHAR(120) NULL,
    qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    status VARCHAR(12) NOT NULL DEFAULT 'Active',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alloc_lot_hdr FOREIGN KEY (allocationId) REFERENCES stock_allocations(id) ON DELETE CASCADE,
    CONSTRAINT fk_alloc_lot_line FOREIGN KEY (lineId) REFERENCES stock_allocation_lines(id) ON DELETE CASCADE,
    KEY idx_alloc_lot_hdr (allocationId),
    KEY idx_alloc_lot_line (lineId),
    KEY idx_alloc_lot_avail (tenantId, productId, branchId, warehouse, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("✓ stock_allocations, stock_allocation_lines, stock_allocation_lots ready");
}

main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
