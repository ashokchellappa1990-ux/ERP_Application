// Tyre Management — inspection, repair, retreading, warranty claims.
//   node --env-file=.env scripts/mig-tyre-service.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS tyre_inspection (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  inspectionNo VARCHAR(30) NOT NULL, tyreId INT NOT NULL, vehicleId INT NULL, positionCode VARCHAR(20) NULL,
  inspectionDate DATETIME NOT NULL, odometer DECIMAL(12,2) NULL,
  treadDepthMm DECIMAL(6,2) NULL, pressurePsi DECIMAL(6,2) NULL, \`condition\` VARCHAR(20) NOT NULL DEFAULT 'Good',
  defectType VARCHAR(60) NULL, inspectedBy INT NULL, recommendedAction VARCHAR(30) NULL, remarks TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ti_no (tenantId, inspectionNo), KEY ix_ti_tyre (tenantId, tyreId), KEY ix_ti_vehicle (tenantId, vehicleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_repair (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  repairNo VARCHAR(30) NOT NULL, tyreId INT NOT NULL, vehicleId INT NULL,
  repairDate DATETIME NOT NULL, odometer DECIMAL(12,2) NULL,
  workshopId INT NULL, workshopName VARCHAR(200) NULL, repairType VARCHAR(60) NULL, description TEXT NULL,
  partsCost DECIMAL(18,2) NOT NULL DEFAULT 0, labourCost DECIMAL(18,2) NOT NULL DEFAULT 0, otherCost DECIMAL(18,2) NOT NULL DEFAULT 0, totalCost DECIMAL(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'Draft', remarks TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelledBy INT NULL, cancelledAt DATETIME NULL, cancellationReason TEXT NULL,
  UNIQUE KEY uq_trep_no (tenantId, repairNo), KEY ix_trep_tyre (tenantId, tyreId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_retreading (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  retreadNo VARCHAR(30) NOT NULL, tyreId INT NOT NULL,
  sentDate DATETIME NOT NULL, sentOdometer DECIMAL(12,2) NULL,
  vendorId INT NULL, vendorName VARCHAR(200) NULL, retreadType VARCHAR(40) NULL, newTreadDepthMm DECIMAL(6,2) NULL,
  cost DECIMAL(18,2) NOT NULL DEFAULT 0, receivedDate DATETIME NULL, status VARCHAR(16) NOT NULL DEFAULT 'Sent', remarks TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tret_no (tenantId, retreadNo), KEY ix_tret_tyre (tenantId, tyreId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS tyre_warranty_claim (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  claimNo VARCHAR(30) NOT NULL, tyreId INT NOT NULL,
  claimDate DATETIME NOT NULL, reason VARCHAR(200) NOT NULL, odometer DECIMAL(12,2) NULL,
  supplierId INT NULL, supplierName VARCHAR(200) NULL,
  claimedAmount DECIMAL(18,2) NULL, approvedAmount DECIMAL(18,2) NULL, creditNoteRef VARCHAR(60) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'Filed', remarks TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_twc_no (tenantId, claimNo), KEY ix_twc_tyre (tenantId, tyreId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'tyre_%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
