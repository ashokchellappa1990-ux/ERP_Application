// Fuel Purchase v2 — Storage vs Vehicle Usage toggle (vehicleId becomes
// optional), split-payment lines (fuel_entry_payment), and bill attachments.
//   node --env-file=.env scripts/mig-fuel-purchase-v2.mjs
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
`CREATE TABLE IF NOT EXISTS fuel_entry_payment (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, fuelEntryId INT NOT NULL,
  mode VARCHAR(30) NOT NULL, amount DECIMAL(14,2) NOT NULL, reference VARCHAR(80) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_fep_tenant_entry (tenantId, fuelEntryId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function main() {
  const c = await pool.getConnection();
  try {
    for (const sql of S) await c.query(sql);
    await addColumn(c, "fuel_entry", "usageType", "usageType VARCHAR(16) NOT NULL DEFAULT 'vehicle'");
    await addColumn(c, "fuel_entry", "attachmentsJson", "attachmentsJson TEXT NULL");
    // vehicleId was NOT NULL — loosen it so a "storage" purchase can omit it.
    await c.query("ALTER TABLE fuel_entry MODIFY vehicleId INT NULL");
    console.log("✓ fuel_entry.vehicleId is now nullable");
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
