// Fuel Entry ("Fuel Purchase" in the UI) — adds real accounting capability:
// Expense Head mapping, GST/invoice fields, Payment (AP vs Pay Now + bank),
// and a new fuel_entry_line table for additional cost lines (e.g. a helper's
// conveyance allowance for that refuelling trip).
//   node --env-file=.env scripts/mig-fuel-entry-accounting.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});

async function columnExists(c, table, column) {
  const rows = await c.query(
    "SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?",
    [process.env.DB_NAME, table, column],
  );
  return Number(rows[0].c) > 0;
}
async function addColumn(c, table, column, ddl) {
  if (await columnExists(c, table, column)) { console.log(`- ${table}.${column} already exists`); return; }
  await c.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`✓ added ${table}.${column}`);
}

const S = [
`CREATE TABLE IF NOT EXISTS fuel_entry_line (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, fuelEntryId INT NOT NULL,
  headId INT NULL, headName VARCHAR(160) NULL, description VARCHAR(300) NULL, amount DECIMAL(14,2) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_fel_tenant_entry (tenantId, fuelEntryId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function main() {
  const c = await pool.getConnection();
  try {
    for (const sql of S) await c.query(sql);
    await addColumn(c, "fuel_entry", "headId", "headId INT NULL");
    await addColumn(c, "fuel_entry", "gstApplicable", "gstApplicable TINYINT(1) NOT NULL DEFAULT 0");
    await addColumn(c, "fuel_entry", "gstPct", "gstPct DECIMAL(9,2) NULL");
    await addColumn(c, "fuel_entry", "taxAmount", "taxAmount DECIMAL(14,2) NOT NULL DEFAULT 0");
    await addColumn(c, "fuel_entry", "otherCost", "otherCost DECIMAL(14,2) NOT NULL DEFAULT 0");
    await addColumn(c, "fuel_entry", "totalAmount", "totalAmount DECIMAL(14,2) NOT NULL DEFAULT 0");
    await addColumn(c, "fuel_entry", "supplierGstin", "supplierGstin VARCHAR(20) NULL");
    await addColumn(c, "fuel_entry", "postingType", "postingType VARCHAR(10) NOT NULL DEFAULT 'paynow'");
    await addColumn(c, "fuel_entry", "bankId", "bankId INT NULL");
    await addColumn(c, "fuel_entry", "bankName", "bankName VARCHAR(160) NULL");
    await addColumn(c, "fuel_entry", "bankAccount", "bankAccount VARCHAR(60) NULL");
    // Backfill totalAmount for any pre-existing rows so old entries aren't left at 0.
    await c.query("UPDATE fuel_entry SET totalAmount = amount WHERE totalAmount = 0");
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
