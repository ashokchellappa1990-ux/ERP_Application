// Tyre Management — extends the existing shared cost-line tables
// (vehicle_maintenance_item / vehicle_maintenance_labour) with a third
// nullable FK, tyreRepairId, alongside maintenanceId/breakdownId (exactly
// one of the three is set per row). Additive only — existing queries that
// filter by maintenanceId/breakdownId are unaffected.
//   node --env-file=.env scripts/mig-tyre-cost-line-fk.mjs
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
    await addColumn(c, "vehicle_maintenance_item", "tyreRepairId", "tyreRepairId INT NULL");
    await c.query("ALTER TABLE vehicle_maintenance_item ADD INDEX IF NOT EXISTS ix_vmi_tyre_repair (tyreRepairId)").catch(() => {});
    await addColumn(c, "vehicle_maintenance_labour", "tyreRepairId", "tyreRepairId INT NULL");
    await c.query("ALTER TABLE vehicle_maintenance_labour ADD INDEX IF NOT EXISTS ix_vml_tyre_repair (tyreRepairId)").catch(() => {});
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
