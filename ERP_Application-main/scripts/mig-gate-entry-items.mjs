// Adds vehicle_gate_entry_items — item/qty detail captured at the gate before
// any allocation/dispatch/invoice exists (purely informational, no stock/GL).
//   node --env-file=.env scripts/mig-gate-entry-items.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});
async function run(sql) { const c = await pool.getConnection(); try { await c.query(sql); } finally { c.release(); } }

async function main() {
  await run(`CREATE TABLE IF NOT EXISTS vehicle_gate_entry_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    gateEntryId INT NOT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    uom VARCHAR(40) NULL,
    qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_gate_entry_items_entry (gateEntryId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ vehicle_gate_entry_items ready");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
