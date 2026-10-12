// Tyre Management — tyre identity + configurable position masters.
//   node --env-file=.env scripts/mig-tyre-master.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS tyre_master (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  tyreCode VARCHAR(40) NOT NULL, serialNo VARCHAR(80) NULL, brand VARCHAR(80) NULL, pattern VARCHAR(80) NULL,
  size VARCHAR(40) NULL, tyreType VARCHAR(30) NULL, category VARCHAR(30) NULL,
  productId INT NULL, supplierId INT NULL, supplierName VARCHAR(200) NULL,
  purchaseDate DATE NULL, purchaseInvoiceNo VARCHAR(60) NULL, purchaseCost DECIMAL(18,2) NOT NULL DEFAULT 0,
  warrantyMonths INT NULL, warrantyKm DECIMAL(12,2) NULL, warrantyExpiryDate DATE NULL,
  originalTreadDepthMm DECIMAL(6,2) NULL, minTreadDepthMm DECIMAL(6,2) NOT NULL DEFAULT 1.6, ratedPressurePsi DECIMAL(6,2) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'In Stock',
  currentVehicleId INT NULL, currentPositionCode VARCHAR(20) NULL, retreadCount INT NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  createdBy INT NULL, updatedBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, deletedAt DATETIME NULL,
  UNIQUE KEY uq_tyre_code (tenantId, tyreCode), KEY ix_tyre_status (tenantId, status), KEY ix_tyre_vehicle (tenantId, currentVehicleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_position_template (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  templateName VARCHAR(80) NOT NULL, vehicleType VARCHAR(60) NULL, numberOfAxles INT NULL,
  isDefault TINYINT(1) NOT NULL DEFAULT 0, status VARCHAR(16) NOT NULL DEFAULT 'Active', remarks TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tpt_name (tenantId, templateName), KEY ix_tpt_vtype (tenantId, vehicleType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_position_code (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, templateId INT NOT NULL,
  positionCode VARCHAR(20) NOT NULL, positionLabel VARCHAR(60) NOT NULL,
  axleNumber INT NULL, side VARCHAR(10) NULL, wheelSet VARCHAR(10) NULL, displayOrder INT NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tpc_code (templateId, positionCode), KEY ix_tpc_tenant_template (tenantId, templateId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'tyre_%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
