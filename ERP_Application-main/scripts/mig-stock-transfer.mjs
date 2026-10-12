// Stock Transfer Request — internal stock movement request between branches (Warehouse Mgmt).
// Records the REQUEST only; NO inventory posting, NO accounting. Source document for the future
// Stock Transfer Dispatch. Mirrors the Sales-Order document + line + status-workflow pattern.
//   node --env-file=.env scripts/mig-stock-transfer.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS stock_transfer_requests (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL,
  requestNo VARCHAR(40) NOT NULL, requestDate VARCHAR(20) NOT NULL, transferType VARCHAR(40) NULL,
  sourceBranchId INT NOT NULL, sourceWarehouse VARCHAR(120) NULL,
  destinationBranchId INT NOT NULL, destinationWarehouse VARCHAR(120) NULL,
  priority VARCHAR(12) NOT NULL DEFAULT 'Normal', requiredDate VARCHAR(20) NULL, expectedDeliveryDate VARCHAR(20) NULL,
  referenceDoc VARCHAR(120) NULL, remarks TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'Draft', approvalStatus VARCHAR(16) NOT NULL DEFAULT 'NotRequired',
  totalRequestedQty DECIMAL(18,3) NOT NULL DEFAULT 0, totalDispatchedQty DECIMAL(18,3) NOT NULL DEFAULT 0, itemCount INT NOT NULL DEFAULT 0,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, submittedBy INT NULL, submittedAt DATETIME NULL,
  approvedBy INT NULL, approvedByName VARCHAR(160) NULL, approvedAt DATETIME NULL,
  rejectedBy INT NULL, rejectReason VARCHAR(300) NULL, cancelledAt DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_str (tenantId, requestNo), KEY ix_str_status (tenantId, status), KEY ix_str_src (tenantId, sourceBranchId), KEY ix_str_dst (tenantId, destinationBranchId), KEY ix_str_date (tenantId, businessId, requestDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS stock_transfer_request_lines (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, requestId INT NOT NULL,
  productId INT NOT NULL, productName VARCHAR(250) NOT NULL, sku VARCHAR(60) NULL, uom VARCHAR(20) NULL,
  availableSource DECIMAL(18,3) NOT NULL DEFAULT 0, availableDest DECIMAL(18,3) NOT NULL DEFAULT 0,
  requestedQty DECIMAL(18,3) NOT NULL DEFAULT 0, minStockQty DECIMAL(18,3) NULL, maxStockQty DECIMAL(18,3) NULL,
  dispatchedQty DECIMAL(18,3) NOT NULL DEFAULT 0, remarks VARCHAR(300) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_strl_req (requestId), KEY ix_strl_prod (tenantId, productId),
  CONSTRAINT fk_strl_req FOREIGN KEY (requestId) REFERENCES stock_transfer_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'stock_transfer%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
