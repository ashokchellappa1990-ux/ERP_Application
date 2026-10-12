// Load & Dispatch v2 — adds invoice-grade line detail (discount/tax) to
// load_dispatch_items, and payment-collection intent (Full/Partial/Credit) to
// load_dispatch so it can be applied correctly when the Sales Invoice actually
// posts (at Delivery Challan generation or manual Post Sales Invoice time).
//   node --env-file=.env scripts/mig-load-dispatch-v2.mjs
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
  console.log("load_dispatch_items — invoice-grade line detail:");
  await addColumn("load_dispatch_items", "discPct", "discPct DECIMAL(9,2) NULL");
  await addColumn("load_dispatch_items", "discAmount", "discAmount DECIMAL(18,2) NOT NULL DEFAULT 0");
  await addColumn("load_dispatch_items", "taxPct", "taxPct DECIMAL(9,2) NULL");
  await addColumn("load_dispatch_items", "taxableValue", "taxableValue DECIMAL(18,2) NOT NULL DEFAULT 0");
  await addColumn("load_dispatch_items", "taxAmount", "taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0");

  console.log("load_dispatch — payment collection intent (applied when the invoice actually posts):");
  await addColumn("load_dispatch", "paymentMode", "paymentMode VARCHAR(16) NULL"); // Full | Partial | Credit
  await addColumn("load_dispatch", "paymentAmount", "paymentAmount DECIMAL(18,2) NULL");
  await addColumn("load_dispatch", "paymentMethod", "paymentMethod VARCHAR(30) NULL"); // Cash | Bank Transfer | UPI | Cheque | Card
  await addColumn("load_dispatch", "bankId", "bankId INT NULL");
  await addColumn("load_dispatch", "bankName", "bankName VARCHAR(150) NULL");
  await addColumn("load_dispatch", "bankAccount", "bankAccount VARCHAR(60) NULL");
  console.log("✓ done");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
