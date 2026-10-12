// First / Second Weighment — common to Sales (Dispatch) and Purchase (Raw
// Material) gate entries. Adds weighmentType to both weighment tables, plus
// grossWeight on the first-weighment table (a Purchase vehicle arrives loaded,
// so its FIRST weighment is the gross weight, not the tare). Additive and
// idempotent; existing rows backfill from their gate entry's entryType.
//   node --env-file=.env scripts/mig-weighment-type.mjs
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
    await addColumn(c, "pre_loading_weighment", "weighmentType", "weighmentType VARCHAR(16) NOT NULL DEFAULT 'Sales'");
    await addColumn(c, "pre_loading_weighment", "grossWeight", "grossWeight DECIMAL(18,3) NULL");
    await addColumn(c, "post_loading_weighment", "weighmentType", "weighmentType VARCHAR(16) NOT NULL DEFAULT 'Sales'");

    for (const table of ["pre_loading_weighment", "post_loading_weighment"]) {
      const r = await c.query(
        `UPDATE ${table} w JOIN vehicle_gate_entry g ON g.id = w.gateEntryId
         SET w.weighmentType = 'Purchase' WHERE g.entryType = 'RawMaterial' AND w.weighmentType <> 'Purchase'`,
      );
      console.log(`✓ ${table}: ${r.affectedRows} row(s) backfilled as Purchase`);
    }
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
