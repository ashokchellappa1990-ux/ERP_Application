// Warehouse Configuration — extends the existing Branch (entity type Warehouse/DC/Dark Store).
// NO warehouse master (Branch is the master). Tables: category master, per-branch configuration
// (hybrid columns + JSON), and parent-warehouse sourcing mappings.
//   node --env-file=.env scripts/mig-warehouse.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS warehouse_category (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL,
  code VARCHAR(40) NOT NULL, name VARCHAR(120) NOT NULL, description VARCHAR(300) NULL,
  storageTypeDefault VARCHAR(20) NULL, displayOrder INT NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'active',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wc (tenantId, code), KEY ix_wc_tenant (tenantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS warehouse_configuration (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NOT NULL,
  warehouseCategoryId INT NULL,
  storageType VARCHAR(20) NULL, capacity DECIMAL(18,2) NULL, capacityUnit VARCHAR(20) NULL,
  maxWeight DECIMAL(18,2) NULL, weightUnit VARCHAR(20) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'Pending',
  config JSON NULL, progress JSON NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wcfg (tenantId, branchId), KEY ix_wcfg_scope (tenantId, businessId), KEY ix_wcfg_cat (tenantId, warehouseCategoryId), KEY ix_wcfg_status (tenantId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS warehouse_parent_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL,
  sourceWarehouseBranchId INT NOT NULL, destinationWarehouseBranchId INT NOT NULL,
  relationshipType VARCHAR(16) NOT NULL DEFAULT 'both', priority VARCHAR(12) NOT NULL DEFAULT 'primary',
  isDefault TINYINT(1) NOT NULL DEFAULT 0, status VARCHAR(16) NOT NULL DEFAULT 'active',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_wpm_dest (tenantId, destinationWarehouseBranchId), KEY ix_wpm_src (tenantId, sourceWarehouseBranchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'warehouse%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
