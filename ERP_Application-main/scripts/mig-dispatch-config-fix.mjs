// Fixes a table-name mismatch: mig-transport.mjs created `dispatch_configuration`
// (singular) but prisma/schema.prisma's DispatchConfiguration model maps to
// `dispatch_configurations` (plural) — causing "table does not exist" at runtime.
//   node --env-file=.env scripts/mig-dispatch-config-fix.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});

async function tableExists(c, name) {
  const rows = await c.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
    [process.env.DB_NAME, name],
  );
  return Number(rows[0].c) > 0;
}

async function main() {
  const c = await pool.getConnection();
  try {
    const hasOld = await tableExists(c, "dispatch_configuration");
    const hasNew = await tableExists(c, "dispatch_configurations");
    if (hasNew) {
      console.log("✓ dispatch_configurations already exists — nothing to do");
    } else if (hasOld) {
      await c.query("RENAME TABLE dispatch_configuration TO dispatch_configurations");
      console.log("✓ renamed dispatch_configuration -> dispatch_configurations");
    } else {
      await c.query(`CREATE TABLE dispatch_configurations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenantId INT NOT NULL,
        businessId INT NULL,
        branchId INT NULL,
        config JSON NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_dispatch_config_scope (tenantId, businessId, branchId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      console.log("✓ created dispatch_configurations");
    }
  } finally {
    c.release();
  }
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
