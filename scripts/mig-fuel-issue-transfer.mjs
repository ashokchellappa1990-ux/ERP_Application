// Fuel Issue gains a "Tank → Tank" transfer mode alongside the existing
// "Tank → Vehicle" dispensing — transferType + toTankId added, vehicleId
// loosened to nullable (required only for tank_vehicle).
//   node --env-file=.env scripts/mig-fuel-issue-transfer.mjs
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

async function main() {
  const c = await pool.getConnection();
  try {
    await addColumn(c, "fuel_issue", "transferType", "transferType VARCHAR(16) NOT NULL DEFAULT 'tank_vehicle'");
    await addColumn(c, "fuel_issue", "toTankId", "toTankId INT NULL");
    await c.query("ALTER TABLE fuel_issue MODIFY vehicleId INT NULL");
    console.log("✓ fuel_issue.vehicleId is now nullable");
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
