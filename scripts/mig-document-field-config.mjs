// Adds document_field_configs — persists Document Field Settings (screen field
// enable/mandatory toggles, GRN batch-pricing fields, company GST flags), which
// was previously an in-memory-only singleton that reset on every server restart.
//   node --env-file=.env scripts/mig-document-field-config.mjs
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
  await run(`CREATE TABLE IF NOT EXISTS document_field_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    config JSON NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_document_field_config_scope (tenantId, businessId, branchId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ document_field_configs ready");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
