import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });
const S = [
`CREATE TABLE IF NOT EXISTS ai_predictions (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  module VARCHAR(24) NOT NULL, metric VARCHAR(40) NOT NULL, label VARCHAR(80) NOT NULL, horizonDays INT NOT NULL,
  forPeriod VARCHAR(10) NOT NULL, currentValue DOUBLE NOT NULL DEFAULT 0, forecastValue DOUBLE NOT NULL DEFAULT 0,
  confidence INT NOT NULL DEFAULT 0, riskScore INT NOT NULL DEFAULT 0, trendPct DOUBLE NOT NULL DEFAULT 0,
  method VARCHAR(16) NOT NULL, unit VARCHAR(10) NOT NULL, seriesJson LONGTEXT NULL, explainJson TEXT NULL,
  actualValue DOUBLE NULL, accuracyPct INT NULL, actualAt DATETIME NULL, createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_pred_metric (tenantId, module, metric), KEY ix_pred_created (tenantId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  source VARCHAR(16) NOT NULL, refKey VARCHAR(160) NOT NULL, module VARCHAR(24) NULL, title VARCHAR(240) NOT NULL,
  recommendation TEXT NULL, decisionTaken VARCHAR(16) NOT NULL DEFAULT 'Pending', takenBy INT NULL, takenByName VARCHAR(160) NULL,
  actualResult VARCHAR(400) NULL, accuracy INT NULL, learningOutcome VARCHAR(400) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_dec_source (tenantId, source), KEY ix_dec_created (tenantId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_decision_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL,
  itemType VARCHAR(16) NOT NULL, itemKey VARCHAR(200) NOT NULL, status VARCHAR(16) NOT NULL,
  assignedTo VARCHAR(120) NULL, note VARCHAR(300) NULL, createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_df (tenantId, itemType, itemKey), KEY ix_df_status (tenantId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  category VARCHAR(40) NOT NULL, severity VARCHAR(12) NOT NULL, title VARCHAR(200) NOT NULL, message VARCHAR(500) NOT NULL,
  href VARCHAR(200) NULL, dedupeKey VARCHAR(200) NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'unread',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notif (tenantId, dedupeKey), KEY ix_notif_status (tenantId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_scenarios (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  name VARCHAR(160) NOT NULL, inputsJson TEXT NOT NULL, resultJson LONGTEXT NULL, createdBy INT NULL, createdByName VARCHAR(160) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_scen_created (tenantId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_model_config (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL UNIQUE, defaultHorizon INT NOT NULL DEFAULT 30,
  defaultMethod VARCHAR(16) NOT NULL DEFAULT 'auto', configJson LONGTEXT NULL, updatedBy INT NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_health_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  snapDate VARCHAR(10) NOT NULL, overall INT NOT NULL DEFAULT 0, band VARCHAR(12) NOT NULL, subScoresJson TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_health (tenantId, businessId, branchId, snapDate), KEY ix_health_date (tenantId, snapDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];
const c = await pool.getConnection();
try { for (const sql of S) await c.query(sql); const t = await c.query("SHOW TABLES LIKE 'ai_%'"); console.log("ai_ tables:", t.map((r) => Object.values(r)[0]).filter((n) => ["ai_predictions","ai_decisions","ai_decision_feedback","ai_notifications","ai_scenarios","ai_model_config","ai_health_snapshots"].includes(n))); } finally { c.release(); await pool.end(); }
console.log("DONE");
