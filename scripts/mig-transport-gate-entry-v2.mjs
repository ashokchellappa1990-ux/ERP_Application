// Vehicle Gate Entry v2 — expands the gate entry capture form to the full
// Recommended Gate Entry Screen (Gate Information / Dispatch Information /
// Reference Document / Transport Details / Driver Details / Vehicle Details /
// Entry Details). Additive only — no existing columns changed.
//   node --env-file=.env scripts/mig-transport-gate-entry-v2.mjs
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
  const cols = [
    // Section 1 – Gate Information
    ["gate", "gate VARCHAR(60) NULL"],
    ["location", "location VARCHAR(150) NULL"],
    // Section 2/3 – Reference Document
    ["referenceType", "referenceType VARCHAR(30) NULL"], // Sales Order | Direct Customer Dispatch
    ["salesOrderId", "salesOrderId INT NULL"],
    ["customerName", "customerName VARCHAR(200) NULL"],
    ["deliveryAddress", "deliveryAddress VARCHAR(400) NULL"],
    ["transferRequestId", "transferRequestId INT NULL"],
    ["sourceWarehouse", "sourceWarehouse VARCHAR(120) NULL"],
    ["destinationWarehouse", "destinationWarehouse VARCHAR(120) NULL"],
    // Section 4 – Transport Details
    ["transportMode", "transportMode VARCHAR(30) NULL"],
    ["vehicleType", "vehicleType VARCHAR(60) NULL"],
    ["trailerNumber", "trailerNumber VARCHAR(40) NULL"],
    ["containerNumber", "containerNumber VARCHAR(40) NULL"],
    // Section 5 – Driver Details (captured fresh at the gate — may differ from any planned driver)
    ["driverName", "driverName VARCHAR(150) NULL"],
    ["driverMobile", "driverMobile VARCHAR(20) NULL"],
    ["driverLicenseNo", "driverLicenseNo VARCHAR(60) NULL"],
    ["helperName", "helperName VARCHAR(150) NULL"],
    ["helperMobile", "helperMobile VARCHAR(20) NULL"],
    // Section 6 – Vehicle Details (optional)
    ["vehicleCapacity", "vehicleCapacity DECIMAL(18,3) NULL"],
    ["expectedLoadWeight", "expectedLoadWeight DECIMAL(18,3) NULL"],
    ["gpsAvailable", "gpsAvailable TINYINT(1) NOT NULL DEFAULT 0"],
    ["sealNumber", "sealNumber VARCHAR(60) NULL"],
    // Section 7 – Entry Details (optional)
    ["purpose", "purpose VARCHAR(200) NULL"],
    ["expectedExitTime", "expectedExitTime DATETIME NULL"],
    ["loadingBayId", "loadingBayId INT NULL"],
  ];
  console.log("vehicle_gate_entry — adding Recommended Gate Entry Screen columns:");
  for (const [col, ddl] of cols) await addColumn("vehicle_gate_entry", col, ddl);
  console.log("✓ done");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
