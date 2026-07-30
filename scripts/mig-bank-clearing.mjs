// Bank reconciliation clearing workflow — add clearing status/date to bank_transactions so
// cheque / bank-transfer / ECS deposits sit as "pending (not cleared)" until cleared with a
// clearing date + status (Credited | Bounced | Cancelled). UPI is auto-credited. Bank balance
// is then driven by the CLEARING date, per bank account.
//   node --env-file=.env scripts/mig-bank-clearing.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });
const c = await pool.getConnection();
async function addCol(table, coldef) { try { await c.query(`ALTER TABLE \`${table}\` ADD COLUMN ${coldef}`); } catch (e) { if (e && e.errno === 1060) return; throw e; } }
try {
  await addCol("bank_transactions", "clearingStatus VARCHAR(12) NOT NULL DEFAULT 'pending'"); // pending | credited | bounced | cancelled
  await addCol("bank_transactions", "clearingDate VARCHAR(20) NULL");
  await addCol("bank_transactions", "clearedBy INT NULL");
  await addCol("bank_transactions", "clearedAt DATETIME NULL");
  await addCol("bank_transactions", "clearNote VARCHAR(300) NULL");
  await c.query("CREATE INDEX ix_bt_clearing ON bank_transactions (tenantId, bankId, clearingStatus)").catch((e) => { if (e.errno !== 1061) throw e; });
  // Backfill: UPI-like modes and already-reconciled rows are treated as credited on their date.
  const u = await c.query("UPDATE bank_transactions SET clearingStatus='credited', clearingDate=`date` WHERE clearingStatus='pending' AND (LOWER(mode) REGEXP 'upi|imps|wallet' OR status='reconciled')");
  const cols = await c.query("SHOW COLUMNS FROM bank_transactions LIKE 'clear%'");
  console.log("clearing cols:", cols.map((r) => r.Field), "| backfilled:", u.affectedRows);
} finally { c.release(); await pool.end(); }
console.log("DONE");
