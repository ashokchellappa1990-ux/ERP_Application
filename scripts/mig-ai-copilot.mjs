/**
 * Additive migration for the AI Copilot Foundation (Phase 1) — 11 ai_* tables.
 * Run: node --env-file=.env scripts/mig-ai-copilot.mjs
 */
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "onepos",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  allowPublicKeyRetrieval: true,
  connectionLimit: 3,
});

const S = [
  `CREATE TABLE IF NOT EXISTS ai_conversation (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
    userId INT NOT NULL, title VARCHAR(200) NOT NULL, category VARCHAR(40) NULL,
    pinned TINYINT(1) NOT NULL DEFAULT 0, messageCount INT NOT NULL DEFAULT 0, lastMessageAt DATETIME NULL,
    createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_conv_user (tenantId, userId), KEY ix_conv_pin (tenantId, pinned)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_messages (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, conversationId INT NOT NULL,
    role VARCHAR(12) NOT NULL, content LONGTEXT NOT NULL, model VARCHAR(60) NULL,
    tokensIn INT NULL, tokensOut INT NULL, latencyMs INT NULL, status VARCHAR(16) NULL, contextJson TEXT NULL,
    createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_msg_conv (tenantId, conversationId),
    CONSTRAINT fk_msg_conv FOREIGN KEY (conversationId) REFERENCES ai_conversation(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_prompt_category (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL, \`key\` VARCHAR(40) NOT NULL, name VARCHAR(80) NOT NULL,
    icon VARCHAR(40) NULL, sortOrder INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cat (tenantId, \`key\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_prompt_library (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL, category VARCHAR(40) NOT NULL, title VARCHAR(200) NOT NULL,
    promptText TEXT NOT NULL, description VARCHAR(300) NULL, isSystem TINYINT(1) NOT NULL DEFAULT 0,
    shared TINYINT(1) NOT NULL DEFAULT 0, usageCount INT NOT NULL DEFAULT 0, createdBy INT NULL, createdByName VARCHAR(120) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_prompt_cat (tenantId, category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_module_registry (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL, moduleKey VARCHAR(60) NOT NULL, name VARCHAR(120) NOT NULL,
    description VARCHAR(400) NULL, menu VARCHAR(120) NULL, businessTerms TEXT NULL, kpis TEXT NULL, questions TEXT NULL,
    actions TEXT NULL, permissions TEXT NULL, tables TEXT NULL, relationships TEXT NULL, enabled TINYINT(1) NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mod (tenantId, moduleKey), KEY ix_mod_en (tenantId, enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_semantic_dictionary (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL, term VARCHAR(120) NOT NULL, normalized VARCHAR(120) NOT NULL,
    moduleKey VARCHAR(60) NULL, entity VARCHAR(120) NOT NULL, kpi VARCHAR(120) NULL, definition VARCHAR(400) NULL, synonyms TEXT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_sem_norm (tenantId, normalized)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_user_favourites (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, userId INT NOT NULL, promptId INT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_fav (userId, promptId), KEY ix_fav_user (tenantId, userId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, messageId INT NOT NULL, userId INT NOT NULL,
    rating VARCHAR(10) NOT NULL, comment VARCHAR(400) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_fb_msg (tenantId, messageId),
    CONSTRAINT fk_fb_msg FOREIGN KEY (messageId) REFERENCES ai_messages(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL, userId INT NULL, model VARCHAR(60) NOT NULL, operation VARCHAR(16) NOT NULL,
    promptTokens INT NOT NULL DEFAULT 0, completionTokens INT NOT NULL DEFAULT 0, totalTokens INT NOT NULL DEFAULT 0,
    latencyMs INT NOT NULL DEFAULT 0, retries INT NOT NULL DEFAULT 0, status VARCHAR(16) NOT NULL, errorMessage VARCHAR(400) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_log_created (tenantId, createdAt), KEY ix_log_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_settings (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL UNIQUE, enabled TINYINT(1) NOT NULL DEFAULT 1,
    provider VARCHAR(20) NOT NULL DEFAULT 'claude', model VARCHAR(60) NOT NULL DEFAULT 'claude-sonnet-4-6',
    maxTokens INT NOT NULL DEFAULT 1024, temperature DECIMAL(3,2) NOT NULL DEFAULT 0.30, streaming TINYINT(1) NOT NULL DEFAULT 1,
    systemPrompt TEXT NULL, dailyTokenLimit INT NULL, retentionDays INT NULL DEFAULT 90, timeoutMs INT NOT NULL DEFAULT 30000,
    maxRetries INT NOT NULL DEFAULT 2, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ai_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NULL, roleKey VARCHAR(60) NOT NULL, moduleKey VARCHAR(60) NOT NULL,
    allowed TINYINT(1) NOT NULL DEFAULT 1, scope VARCHAR(20) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_perm (tenantId, roleKey, moduleKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const conn = await pool.getConnection();
try {
  for (const sql of S) { await conn.query(sql); }
  const t = await conn.query("SHOW TABLES LIKE 'ai_%'");
  console.log("AI tables:", t.map((r) => Object.values(r)[0]));
} finally { conn.release(); await pool.end(); }
console.log("DONE");
