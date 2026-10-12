// Adds Driver Batta / Vehicle Rent / Transit Pass to transport_cost — three
// new, individually document-field-configurable charge line items, distinct
// from the existing driverAllowance ("Driver Allowance (Bata)") field.
//   node --env-file=.env scripts/mig-transport-cost-fields.mjs
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
    await addColumn(c, "transport_cost", "driverBatta", "driverBatta DECIMAL(18,2) NOT NULL DEFAULT 0");
    await addColumn(c, "transport_cost", "vehicleRent", "vehicleRent DECIMAL(18,2) NOT NULL DEFAULT 0");
    await addColumn(c, "transport_cost", "transitPass", "transitPass DECIMAL(18,2) NOT NULL DEFAULT 0");
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
