// Vehicle Document & Compliance — document types, documents (versioned),
// attachments, renewal workflow, mandatory-per-vehicle-type config, and
// compliance configuration. Additive over VehicleMaster (vehicleId only).
//   node --env-file=.env scripts/mig-vehicle-document.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS vehicle_document_type (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL,
  code VARCHAR(30) NOT NULL, name VARCHAR(120) NOT NULL, description TEXT NULL,
  applicableVehicleTypes TEXT NULL,
  mandatory TINYINT(1) NOT NULL DEFAULT 0, expiryRequired TINYINT(1) NOT NULL DEFAULT 1,
  renewalRequired TINYINT(1) NOT NULL DEFAULT 1, alertEnabled TINYINT(1) NOT NULL DEFAULT 1,
  defaultAlertDays INT NOT NULL DEFAULT 30, isSystem TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vdt_code (tenantId, code), KEY ix_vdt_status (tenantId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS vehicle_document_mandatory (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL,
  vehicleType VARCHAR(60) NOT NULL, documentTypeId INT NOT NULL, mandatory TINYINT(1) NOT NULL DEFAULT 1,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vdm (tenantId, vehicleType, documentTypeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS vehicle_document (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  vehicleId INT NOT NULL, documentTypeId INT NOT NULL,
  documentNo VARCHAR(80) NULL, issueDate DATE NULL, expiryDate DATE NULL,
  issuingAuthority VARCHAR(150) NULL, placeOfIssue VARCHAR(150) NULL,
  renewalRequired TINYINT(1) NOT NULL DEFAULT 1, renewalFrequencyMonths INT NULL,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0, tax DECIMAL(14,2) NOT NULL DEFAULT 0,
  otherCharges DECIMAL(14,2) NOT NULL DEFAULT 0, totalCost DECIMAL(14,2) NOT NULL DEFAULT 0,
  paymentDate DATE NULL, paymentReference VARCHAR(80) NULL, remarks TEXT NULL,
  previousDocId INT NULL, versionNo INT NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelledBy INT NULL, cancelledAt DATETIME NULL, cancellationReason TEXT NULL,
  KEY ix_vd_vehicle (tenantId, vehicleId), KEY ix_vd_type (tenantId, documentTypeId),
  KEY ix_vd_status (tenantId, status), KEY ix_vd_expiry (tenantId, expiryDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS vehicle_document_attachment (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, vehicleDocumentId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL, fileUrl VARCHAR(500) NOT NULL, fileType VARCHAR(60) NULL, size INT NULL,
  uploadedBy INT NULL, uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_vda_doc (tenantId, vehicleDocumentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS vehicle_document_renewal (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  vehicleDocumentId INT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'Pending',
  initiatedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  newDocumentNo VARCHAR(80) NULL, newIssueDate DATE NULL, newExpiryDate DATE NULL, renewalDate DATE NULL,
  renewalCost DECIMAL(14,2) NOT NULL DEFAULT 0, tax DECIMAL(14,2) NOT NULL DEFAULT 0,
  otherCharges DECIMAL(14,2) NOT NULL DEFAULT 0, totalCost DECIMAL(14,2) NOT NULL DEFAULT 0,
  issuingAuthority VARCHAR(150) NULL, remarks TEXT NULL, newDocumentId INT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_vdr_doc (tenantId, vehicleDocumentId), KEY ix_vdr_status (tenantId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS vehicle_compliance_config (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  checkEnabled TINYINT(1) NOT NULL DEFAULT 0, enforcementMode VARCHAR(10) NOT NULL DEFAULT 'warning',
  alertDaysJson TEXT NOT NULL, expiringSoonDays INT NOT NULL DEFAULT 30,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vcc_scope (tenantId, businessId, branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const SEED_TYPES = [
  ["RC", "RC / Registration Certificate", 1],
  ["INSURANCE", "Insurance", 1],
  ["FITNESS", "Fitness Certificate", 1],
  ["PUC", "PUC / Pollution Certificate", 1],
  ["ROAD_TAX", "Road Tax", 1],
  ["NATIONAL_PERMIT", "National Permit", 0],
  ["STATE_PERMIT", "State Permit", 0],
  ["GOODS_CARRIAGE_PERMIT", "Goods Carriage Permit", 0],
  ["FASTAG", "FASTag", 0],
  ["OTHER", "Other", 0],
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);

  // Seed the initial document types once per tenant that has at least one
  // vehicle — fully editable afterwards, never re-seeded/overwritten.
  const tenants = await c.query("SELECT DISTINCT tenantId FROM vehicle_master");
  for (const { tenantId } of tenants) {
    const existing = await c.query("SELECT COUNT(*) AS c FROM vehicle_document_type WHERE tenantId = ?", [tenantId]);
    if (Number(existing[0].c) > 0) continue;
    for (const [code, name, mandatory] of SEED_TYPES) {
      await c.query(
        "INSERT INTO vehicle_document_type (tenantId, code, name, mandatory, expiryRequired, renewalRequired, alertEnabled, defaultAlertDays, isSystem, status) VALUES (?,?,?,?,1,1,1,30,1,'Active')",
        [tenantId, code, name, mandatory],
      );
    }
    console.log(`✓ seeded ${SEED_TYPES.length} document types for tenant ${tenantId}`);
  }

  const t = await c.query("SHOW TABLES LIKE 'vehicle_document%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
  const t2 = await c.query("SHOW TABLES LIKE 'vehicle_compliance%'");
  console.log("Tables:", t2.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
