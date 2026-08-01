// Fixes load_dispatch.status being VARCHAR(24) — too narrow for the literal
// "Delivery Challan Generated" (26 chars), which was silently truncated by
// MySQL on write (non-strict mode), breaking the status timeline UI (it could
// no longer match STATUS_STEPS) and the header status badge. Widens the
// column and repairs any rows already saved with the truncated value.
//   node --env-file=.env scripts/mig-load-dispatch-status-widen.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});

async function main() {
  const c = await pool.getConnection();
  try {
    await c.query("ALTER TABLE load_dispatch MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Draft'");
    console.log("✓ widened load_dispatch.status to VARCHAR(30)");
    const res = await c.query("UPDATE load_dispatch SET status = 'Delivery Challan Generated' WHERE status LIKE 'Delivery Challan Genera%' AND status <> 'Delivery Challan Generated'");
    console.log(`✓ repaired ${res.affectedRows ?? 0} truncated row(s)`);
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
