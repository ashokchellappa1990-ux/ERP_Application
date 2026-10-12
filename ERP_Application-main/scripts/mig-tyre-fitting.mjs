// Tyre Management — fitting (vehicle-linking) and rotation transactions.
//   node --env-file=.env scripts/mig-tyre-fitting.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS tyre_vehicle_fitting (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  tyreId INT NOT NULL, vehicleId INT NOT NULL, positionCode VARCHAR(20) NOT NULL,
  fittedAt DATETIME NOT NULL, fittedOdometer DECIMAL(12,2) NULL, fittedBy INT NULL,
  removedAt DATETIME NULL, removedOdometer DECIMAL(12,2) NULL, removalReason VARCHAR(60) NULL, removedBy INT NULL,
  runningKm DECIMAL(12,2) NULL, status VARCHAR(12) NOT NULL DEFAULT 'Active',
  remarks TEXT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_tvf_tyre (tenantId, tyreId), KEY ix_tvf_vehicle_pos (tenantId, vehicleId, positionCode, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_rotation (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  rotationNo VARCHAR(30) NOT NULL, vehicleId INT NOT NULL, rotationDate DATETIME NOT NULL,
  odometer DECIMAL(12,2) NULL, performedBy INT NULL, remarks TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tr_no (tenantId, rotationNo), KEY ix_tr_vehicle (tenantId, vehicleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_rotation_line (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, rotationId INT NOT NULL,
  tyreId INT NOT NULL, fromPositionCode VARCHAR(20) NULL, toPositionCode VARCHAR(20) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_trl_rotation (rotationId), KEY ix_trl_tenant_tyre (tenantId, tyreId),
  CONSTRAINT fk_trl_rotation FOREIGN KEY (rotationId) REFERENCES tyre_rotation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'tyre_%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
