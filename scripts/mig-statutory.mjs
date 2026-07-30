/**
 * Additive migration for the Statutory Compliance module — creates
 * statutory_payments + statutory_returns. Run:
 *   node_modules/.bin/tsx --env-file=.env scripts/mig-statutory.mjs
 * (or) node --env-file=.env scripts/mig-statutory.mjs
 */
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "onepos",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  allowPublicKeyRetrieval: true,
  connectionLimit: 3,
});

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS statutory_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    paymentNo VARCHAR(40) NOT NULL,
    paymentDate VARCHAR(20) NOT NULL,
    statutoryType VARCHAR(12) NOT NULL,
    financialYear VARCHAR(10) NOT NULL,
    taxPeriod VARCHAR(7) NOT NULL,
    liabilityAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    alreadyPaid DECIMAL(18,2) NOT NULL DEFAULT 0,
    balanceAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    interest DECIMAL(18,2) NOT NULL DEFAULT 0,
    penalty DECIMAL(18,2) NOT NULL DEFAULT 0,
    paidAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalPayable DECIMAL(18,2) NOT NULL DEFAULT 0,
    breakupJson TEXT NULL,
    paymentMode VARCHAR(20) NULL,
    bankAccount VARCHAR(120) NULL,
    referenceNo VARCHAR(60) NULL,
    transactionNo VARCHAR(60) NULL,
    remarks VARCHAR(500) NULL,
    challanNo VARCHAR(60) NULL,
    cpin VARCHAR(40) NULL,
    cin VARCHAR(40) NULL,
    bsrCode VARCHAR(20) NULL,
    challanBank VARCHAR(120) NULL,
    govRef VARCHAR(60) NULL,
    ackNo VARCHAR(60) NULL,
    challanStatus VARCHAR(12) NOT NULL DEFAULT 'Pending',
    challanVerifiedBy INT NULL,
    challanVerifiedAt DATETIME NULL,
    attachmentsJson TEXT NULL,
    journalId INT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'Draft',
    createdBy INT NULL,
    submittedBy INT NULL,
    submittedAt DATETIME NULL,
    approvedBy INT NULL,
    approvedByName VARCHAR(200) NULL,
    approvedAt DATETIME NULL,
    cancelledBy INT NULL,
    cancelledAt DATETIME NULL,
    cancelReason VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_statpay_no (tenantId, paymentNo),
    KEY ix_statpay_type_period (tenantId, statutoryType, taxPeriod),
    KEY ix_statpay_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS statutory_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    statutoryType VARCHAR(12) NOT NULL,
    returnType VARCHAR(20) NOT NULL,
    financialYear VARCHAR(10) NOT NULL,
    taxPeriod VARCHAR(7) NOT NULL,
    liabilityAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(12) NOT NULL DEFAULT 'Pending',
    filedDate VARCHAR(20) NULL,
    ackNo VARCHAR(60) NULL,
    remarks VARCHAR(500) NULL,
    attachmentsJson TEXT NULL,
    createdBy INT NULL,
    filedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_statret_type_period (tenantId, statutoryType, taxPeriod),
    KEY ix_statret_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const conn = await pool.getConnection();
try {
  for (const sql of STATEMENTS) {
    await conn.query(sql);
    console.log("OK:", sql.slice(0, 48).replace(/\s+/g, " "));
  }
  const t = await conn.query("SHOW TABLES LIKE 'statutory_%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally {
  conn.release();
  await pool.end();
}
console.log("DONE");
