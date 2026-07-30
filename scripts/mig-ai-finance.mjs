/**
 * Additive migration for the AI Finance Intelligence panel — ai_finance_feedback.
 * Run: node --env-file=.env scripts/mig-ai-finance.mjs
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

const SQL = `CREATE TABLE IF NOT EXISTS ai_finance_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  businessId INT NULL,
  itemType VARCHAR(12) NOT NULL,
  itemKey VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL,
  assignedTo VARCHAR(120) NULL,
  note VARCHAR(300) NULL,
  createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aiff (tenantId, itemType, itemKey),
  KEY ix_aiff_status (tenantId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const conn = await pool.getConnection();
try {
  await conn.query(SQL);
  const t = await conn.query("SHOW TABLES LIKE 'ai_finance_feedback'");
  console.log("OK:", t.map((r) => Object.values(r)[0]));
} finally {
  conn.release();
  await pool.end();
}
console.log("DONE");
