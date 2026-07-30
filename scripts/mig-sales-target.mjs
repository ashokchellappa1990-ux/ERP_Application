// Enterprise Sales Performance Management — Sales Target planning + achievement +
// performance engine. Config-driven; mirrors the Budget module (header + lines with
// m1..m12 FY buckets, revisions never overwrite). Achievement is computed live from Sale.
//   node --env-file=.env scripts/mig-sales-target.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const M = "m1 DECIMAL(18,2) NOT NULL DEFAULT 0, m2 DECIMAL(18,2) NOT NULL DEFAULT 0, m3 DECIMAL(18,2) NOT NULL DEFAULT 0, m4 DECIMAL(18,2) NOT NULL DEFAULT 0, m5 DECIMAL(18,2) NOT NULL DEFAULT 0, m6 DECIMAL(18,2) NOT NULL DEFAULT 0, m7 DECIMAL(18,2) NOT NULL DEFAULT 0, m8 DECIMAL(18,2) NOT NULL DEFAULT 0, m9 DECIMAL(18,2) NOT NULL DEFAULT 0, m10 DECIMAL(18,2) NOT NULL DEFAULT 0, m11 DECIMAL(18,2) NOT NULL DEFAULT 0, m12 DECIMAL(18,2) NOT NULL DEFAULT 0";

const S = [
`CREATE TABLE IF NOT EXISTS sales_targets (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  targetNo VARCHAR(40) NOT NULL, fy VARCHAR(20) NOT NULL, title VARCHAR(200) NULL,
  dimension VARCHAR(24) NOT NULL DEFAULT 'branch', targetType VARCHAR(28) NOT NULL DEFAULT 'salesValue',
  period VARCHAR(16) NOT NULL DEFAULT 'monthly', distribution VARCHAR(16) NOT NULL DEFAULT 'equal',
  currency VARCHAR(10) NOT NULL DEFAULT 'INR', fromDate VARCHAR(20) NULL, toDate VARCHAR(20) NULL,
  totalTarget DECIMAL(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'Draft', approvalStatus VARCHAR(16) NOT NULL DEFAULT 'NotRequired',
  remarks TEXT NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, submittedBy INT NULL, submittedAt DATETIME NULL,
  approvedBy INT NULL, approvedByName VARCHAR(160) NULL, approvedAt DATETIME NULL,
  rejectedBy INT NULL, rejectReason VARCHAR(300) NULL, returnedAt DATETIME NULL, lockedAt DATETIME NULL, cancelledAt DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tgt (tenantId, targetNo), KEY ix_tgt_fy (tenantId, fy), KEY ix_tgt_scope (tenantId, businessId, branchId),
  KEY ix_tgt_status (tenantId, status), KEY ix_tgt_dim (tenantId, dimension, targetType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS sales_target_lines (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, targetId INT NOT NULL,
  dimensionType VARCHAR(24) NOT NULL, dimensionRefId INT NULL, dimensionValue VARCHAR(160) NULL, dimensionLabel VARCHAR(200) NULL,
  parentRefId INT NULL, annual DECIMAL(18,2) NOT NULL DEFAULT 0, ${M},
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tl (targetId, dimensionType, dimensionRefId, dimensionValue), KEY ix_tl_tenant (tenantId, dimensionType),
  CONSTRAINT fk_tl_tgt FOREIGN KEY (targetId) REFERENCES sales_targets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS sales_target_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, targetId INT NOT NULL, lineId INT NULL,
  revisionNo VARCHAR(40) NOT NULL, revisionDate VARCHAR(20) NOT NULL, dimensionLabel VARCHAR(200) NULL,
  revisionType VARCHAR(10) NOT NULL DEFAULT 'increase', previousTarget DECIMAL(18,2) NOT NULL DEFAULT 0,
  revisedTarget DECIMAL(18,2) NOT NULL DEFAULT 0, difference DECIMAL(18,2) NOT NULL DEFAULT 0,
  reason TEXT NULL, effectiveDate VARCHAR(20) NULL, remarks TEXT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'Pending', requestedBy INT NULL, requestedByName VARCHAR(160) NULL,
  approvedBy INT NULL, rejectedBy INT NULL, approvedAt DATETIME NULL, rejectReason VARCHAR(300) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_trv_tgt (tenantId, targetId), KEY ix_trv_status (tenantId, status),
  CONSTRAINT fk_trv_tgt FOREIGN KEY (targetId) REFERENCES sales_targets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS sales_target_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, targetId INT NOT NULL,
  level INT NOT NULL DEFAULT 1, action VARCHAR(16) NOT NULL, actorId INT NULL, actorName VARCHAR(160) NULL, remarks VARCHAR(300) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_ta_tgt (tenantId, targetId),
  CONSTRAINT fk_ta_tgt FOREIGN KEY (targetId) REFERENCES sales_targets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS sales_target_config (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  config JSON NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stc (tenantId, businessId, branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS sales_target_counters (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, scopeKey VARCHAR(60) NOT NULL DEFAULT 'default', seq INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_stcnt (tenantId, scopeKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

`CREATE TABLE IF NOT EXISTS sales_performance_scores (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  fy VARCHAR(20) NOT NULL, period VARCHAR(16) NOT NULL DEFAULT 'monthly', periodKey VARCHAR(12) NULL,
  subjectType VARCHAR(24) NOT NULL, subjectRefId INT NULL, subjectLabel VARCHAR(200) NULL,
  targetValue DECIMAL(18,2) NOT NULL DEFAULT 0, actualValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  achievementScore DECIMAL(6,2) NOT NULL DEFAULT 0, growthScore DECIMAL(6,2) NOT NULL DEFAULT 0,
  profitScore DECIMAL(6,2) NOT NULL DEFAULT 0, consistencyScore DECIMAL(6,2) NOT NULL DEFAULT 0,
  completionScore DECIMAL(6,2) NOT NULL DEFAULT 0, overallScore DECIMAL(6,2) NOT NULL DEFAULT 0,
  computedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sps (tenantId, fy, period, subjectType, subjectRefId, subjectLabel), KEY ix_sps_scope (tenantId, businessId, branchId, fy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'sales_target%'");
  const p = await c.query("SHOW TABLES LIKE 'sales_performance%'");
  console.log("Tables:", [...t, ...p].map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
