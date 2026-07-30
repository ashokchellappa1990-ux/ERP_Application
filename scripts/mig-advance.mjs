// Enterprise Advance Management System — one common engine (customer / supplier /
// employee), settlement + refund as separate records, GL-integrated. No stock.
//   node --env-file=.env scripts/mig-advance.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS advance_types (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL,
  code VARCHAR(40) NOT NULL, name VARCHAR(120) NOT NULL, direction VARCHAR(12) NOT NULL DEFAULT 'received',
  accountCode VARCHAR(20) NOT NULL, partyType VARCHAR(20) NOT NULL DEFAULT 'Customer', description VARCHAR(300) NULL,
  allowRefund TINYINT(1) NOT NULL DEFAULT 1, allowPartial TINYINT(1) NOT NULL DEFAULT 1, displayOrder INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_at_tenant (tenantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS advance_configs (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  config JSON NOT NULL, seqAdvance INT NOT NULL DEFAULT 0, seqSettlement INT NOT NULL DEFAULT 0, seqRefund INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ac (tenantId, businessId, branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS advances (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  advanceNo VARCHAR(40) NOT NULL, advanceDate VARCHAR(20) NOT NULL, department VARCHAR(120) NULL, costCenterId INT NULL, profitCenterId INT NULL,
  advanceTypeId INT NULL, advanceTypeName VARCHAR(120) NULL, direction VARCHAR(12) NOT NULL DEFAULT 'received', accountCode VARCHAR(20) NULL,
  partyType VARCHAR(20) NOT NULL DEFAULT 'Customer', partyId INT NULL, partyName VARCHAR(200) NULL,
  refDocType VARCHAR(30) NULL, refDocId INT NULL, refNo VARCHAR(80) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR', exchangeRate DECIMAL(12,4) NOT NULL DEFAULT 1,
  advanceAmount DECIMAL(18,2) NOT NULL DEFAULT 0, taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0, netAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  paymentMode VARCHAR(20) NULL, paymentRef VARCHAR(80) NULL, narration VARCHAR(500) NULL, attachments JSON NULL,
  settledAmount DECIMAL(18,2) NOT NULL DEFAULT 0, refundedAmount DECIMAL(18,2) NOT NULL DEFAULT 0, balanceAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  approvalStatus VARCHAR(16) NOT NULL DEFAULT 'Draft', status VARCHAR(20) NOT NULL DEFAULT 'Draft', journalId INT NULL,
  approvedBy INT NULL, approvedByName VARCHAR(160) NULL, approvedAt DATETIME NULL, approvalNote VARCHAR(300) NULL, cancelledAt DATETIME NULL, cancelReason VARCHAR(300) NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  terminalId INT NULL, terminalSessionId INT NULL, shiftSessionId INT NULL, cashierUserId INT NULL, deviceId VARCHAR(80) NULL, transactionSource VARCHAR(20) NULL, dayOpeningId INT NULL, dayClosingId INT NULL,
  UNIQUE KEY uq_adv (tenantId, advanceNo), KEY ix_adv_status (tenantId, status), KEY ix_adv_party (tenantId, partyType, partyId), KEY ix_adv_type (tenantId, advanceTypeId), KEY ix_adv_date (tenantId, branchId, advanceDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS advance_settlements (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  settlementNo VARCHAR(40) NOT NULL, settlementDate VARCHAR(20) NOT NULL, advanceId INT NOT NULL,
  refDocType VARCHAR(30) NULL, refDocId INT NULL, refNo VARCHAR(80) NULL, refInvoice VARCHAR(80) NULL,
  settlementAmount DECIMAL(18,2) NOT NULL DEFAULT 0, method VARCHAR(16) NOT NULL DEFAULT 'Manual', expenseAccountCode VARCHAR(20) NULL, remarks VARCHAR(500) NULL, attachments JSON NULL,
  approvalStatus VARCHAR(16) NOT NULL DEFAULT 'Draft', status VARCHAR(20) NOT NULL DEFAULT 'Draft', journalId INT NULL, reversedAt DATETIME NULL, reverseReason VARCHAR(300) NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sett (tenantId, settlementNo), KEY ix_sett_adv (advanceId), KEY ix_sett_status (tenantId, status),
  CONSTRAINT fk_sett_adv FOREIGN KEY (advanceId) REFERENCES advances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS advance_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  refundNo VARCHAR(40) NOT NULL, refundDate VARCHAR(20) NOT NULL, advanceId INT NOT NULL,
  refundAmount DECIMAL(18,2) NOT NULL DEFAULT 0, refundMode VARCHAR(20) NULL, reason VARCHAR(300) NULL, narration VARCHAR(500) NULL, attachments JSON NULL,
  approvalStatus VARCHAR(16) NOT NULL DEFAULT 'Draft', status VARCHAR(20) NOT NULL DEFAULT 'Draft', journalId INT NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ref (tenantId, refundNo), KEY ix_ref_adv (advanceId), KEY ix_ref_status (tenantId, status),
  CONSTRAINT fk_ref_adv FOREIGN KEY (advanceId) REFERENCES advances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'advance%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
