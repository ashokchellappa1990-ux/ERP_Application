import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });
const S = [
`CREATE TABLE IF NOT EXISTS ai_command_draft (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL, userId INT NOT NULL, conversationId INT NULL,
  module VARCHAR(40) NOT NULL, txType VARCHAR(40) NOT NULL, txLabel VARCHAR(80) NOT NULL, intent VARCHAR(200) NULL,
  fieldsJson TEXT NULL, missingJson TEXT NULL, askKey VARCHAR(60) NULL, summary VARCHAR(500) NULL, targetHref VARCHAR(160) NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'Medium', status VARCHAR(16) NOT NULL DEFAULT 'Collecting', validationJson TEXT NULL,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_draft_user (tenantId, userId, status), KEY ix_draft_conv (conversationId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS ai_command_action (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL, userId INT NOT NULL,
  actionNo VARCHAR(40) NOT NULL, prompt VARCHAR(500) NOT NULL, intent VARCHAR(40) NOT NULL, module VARCHAR(40) NULL, txType VARCHAR(40) NULL,
  draftId INT NULL, target VARCHAR(160) NULL, status VARCHAR(20) NOT NULL, detail VARCHAR(400) NULL, latencyMs INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_act_user (tenantId, userId), KEY ix_act_created (tenantId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];
const c = await pool.getConnection();
try { for (const sql of S) await c.query(sql); const t = await c.query("SHOW TABLES LIKE 'ai_command_%'"); console.log("Tables:", t.map(r=>Object.values(r)[0])); } finally { c.release(); await pool.end(); }
console.log("DONE");
