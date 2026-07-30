// Bank details on payment/receipt transactions + a bank movement ledger for per-bank
// balance & reconciliation. Bank master = existing setup_banks (branch-mapped). GL is
// UNCHANGED (single Cash-at-Bank account) — bank detail lives here, not as new GL codes.
//   node --env-file=.env scripts/mig-bank-ledger.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const c = await pool.getConnection();
// add a column, ignoring "duplicate column" (1060) so the script is idempotent
async function addCol(table, coldef) {
  try { await c.query(`ALTER TABLE \`${table}\` ADD COLUMN ${coldef}`); }
  catch (e) { if (e && e.errno === 1060) return; throw e; }
}
try {
  await addCol("setup_banks", "openingBalance DECIMAL(18,2) NOT NULL DEFAULT 0");
  for (const t of ["supplier_payments", "customer_collections", "petty_cash_vouchers", "advances", "sales"]) {
    await addCol(t, "bankId INT NULL");
    await addCol(t, "bankName VARCHAR(150) NULL");
    await addCol(t, "bankAccount VARCHAR(60) NULL");
  }
  await addCol("receipt_transaction", "bankId INT NULL");
  await addCol("receipt_transaction", "bankAccount VARCHAR(60) NULL");

  await c.query(`CREATE TABLE IF NOT EXISTS bank_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
    bankId INT NOT NULL, bankName VARCHAR(150) NULL, bankAccount VARCHAR(60) NULL,
    date VARCHAR(20) NOT NULL, direction VARCHAR(4) NOT NULL, amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    mode VARCHAR(30) NULL, reference VARCHAR(120) NULL,
    sourceType VARCHAR(40) NOT NULL, sourceId INT NULL, sourceNo VARCHAR(60) NULL, partyName VARCHAR(200) NULL,
    journalId INT NULL, narration VARCHAR(300) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'unreconciled', reconciledAt DATETIME NULL, reconciledBy INT NULL,
    createdBy INT NULL, createdByName VARCHAR(160) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_bt_bank (tenantId, bankId, date), KEY ix_bt_scope (tenantId, businessId, branchId),
    KEY ix_bt_source (tenantId, sourceType, sourceId), KEY ix_bt_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const t = await c.query("SHOW TABLES LIKE 'bank_transactions'");
  const cols = await c.query("SHOW COLUMNS FROM supplier_payments LIKE 'bank%'");
  const ob = await c.query("SHOW COLUMNS FROM setup_banks LIKE 'openingBalance'");
  console.log("bank_transactions:", t.length ? "created" : "MISSING");
  console.log("supplier_payments bank cols:", cols.map((r) => r.Field));
  console.log("setup_banks openingBalance:", ob.length ? "yes" : "no");
} finally { c.release(); await pool.end(); }
console.log("DONE");
