import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });
const S = [
`CREATE TABLE IF NOT EXISTS doc_categories (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  name VARCHAR(120) NOT NULL, slug VARCHAR(140) NOT NULL, parentId INT NULL, description VARCHAR(300) NULL,
  color VARCHAR(20) NULL, icon VARCHAR(40) NULL, systemSeed TINYINT(1) NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1,
  sortOrder INT NOT NULL DEFAULT 0, createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_cat_active (tenantId, active), KEY ix_cat_parent (tenantId, parentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_folders (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  name VARCHAR(140) NOT NULL, parentId INT NULL, path VARCHAR(500) NULL, createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_fold_parent (tenantId, parentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  docNo VARCHAR(40) NOT NULL, title VARCHAR(240) NOT NULL, description VARCHAR(600) NULL,
  categoryId INT NULL, folderId INT NULL, ownerId INT NULL, ownerName VARCHAR(160) NULL, department VARCHAR(80) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'Draft', language VARCHAR(12) NOT NULL DEFAULT 'en', tagsJson TEXT NULL,
  fileName VARCHAR(260) NOT NULL, fileUrl TEXT NOT NULL, fileType VARCHAR(120) NULL, fileExt VARCHAR(12) NULL,
  fileSize INT NOT NULL DEFAULT 0, checksum VARCHAR(80) NULL, extractedText LONGTEXT NULL, keywordsJson TEXT NULL,
  entitiesJson TEXT NULL, summaryJson TEXT NULL, ocrStatus VARCHAR(16) NOT NULL DEFAULT 'none', ocrText LONGTEXT NULL,
  linkedModule VARCHAR(40) NULL, linkedType VARCHAR(40) NULL, linkedId INT NULL,
  viewCount INT NOT NULL DEFAULT 0, downloadCount INT NOT NULL DEFAULT 0, currentVersion INT NOT NULL DEFAULT 1,
  approvedById INT NULL, approvedByName VARCHAR(160) NULL, approvedAt DATETIME NULL, publishedAt DATETIME NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_doc_status (tenantId, status), KEY ix_doc_cat (tenantId, categoryId), KEY ix_doc_fold (tenantId, folderId), KEY ix_doc_no (tenantId, docNo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_versions (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, documentId INT NOT NULL, versionNo INT NOT NULL,
  fileName VARCHAR(260) NOT NULL, fileUrl TEXT NOT NULL, fileType VARCHAR(120) NULL, fileSize INT NOT NULL DEFAULT 0,
  extractedText LONGTEXT NULL, author VARCHAR(160) NULL, authorId INT NULL, approverId INT NULL, approverName VARCHAR(160) NULL,
  reason VARCHAR(400) NULL, approvedAt DATETIME NULL, isCurrent TINYINT(1) NOT NULL DEFAULT 0, createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_ver_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_chunks (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, documentId INT NOT NULL, chunkNo INT NOT NULL,
  text TEXT NOT NULL, tokens INT NOT NULL DEFAULT 0, embeddingJson LONGTEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_chunk_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, documentId INT NOT NULL, roleId INT NULL, role VARCHAR(60) NULL,
  userId INT NULL, canView TINYINT(1) NOT NULL DEFAULT 1, canDownload TINYINT(1) NOT NULL DEFAULT 1,
  canEdit TINYINT(1) NOT NULL DEFAULT 0, canApprove TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_perm_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS knowledge_base (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  question VARCHAR(500) NOT NULL, answer LONGTEXT NOT NULL, categoryId INT NULL, department VARCHAR(80) NULL,
  ownerId INT NULL, ownerName VARCHAR(160) NULL, source VARCHAR(16) NOT NULL DEFAULT 'manual', documentId INT NULL,
  tagsJson TEXT NULL, status VARCHAR(12) NOT NULL DEFAULT 'Published', views INT NOT NULL DEFAULT 0, upvotes INT NOT NULL DEFAULT 0,
  createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_kb_status (tenantId, status), KEY ix_kb_cat (tenantId, categoryId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_faqs (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, documentId INT NOT NULL, question VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL, sortOrder INT NOT NULL DEFAULT 0, generatedBy VARCHAR(10) NOT NULL DEFAULT 'ai', createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_faq_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_ai_queries (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL, userId INT NULL,
  documentId INT NULL, scope VARCHAR(16) NOT NULL, query TEXT NOT NULL, answer LONGTEXT NULL, model VARCHAR(60) NULL,
  status VARCHAR(16) NULL, latencyMs INT NULL, tokensOut INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_q_scope (tenantId, scope), KEY ix_q_created (tenantId, createdAt), KEY ix_q_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_comparisons (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, leftDocId INT NOT NULL, rightDocId INT NOT NULL,
  resultJson LONGTEXT NULL, createdBy INT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_cmp_left (tenantId, leftDocId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_translations (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, documentId INT NOT NULL, targetLang VARCHAR(12) NOT NULL,
  translatedText LONGTEXT NULL, status VARCHAR(16) NOT NULL DEFAULT 'completed', model VARCHAR(60) NULL, createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_tr_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_ocr_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, documentId INT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
  engine VARCHAR(40) NULL, extractedText LONGTEXT NULL, fieldsJson TEXT NULL, error VARCHAR(400) NULL, createdBy INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completedAt DATETIME NULL,
  KEY ix_ocr_status (tenantId, status), KEY ix_ocr_doc (tenantId, documentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS doc_settings (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL UNIQUE, maxFileSizeMb INT NOT NULL DEFAULT 25,
  allowedTypesJson TEXT NULL, langsJson TEXT NULL, ocrEnabled TINYINT(1) NOT NULL DEFAULT 1, autoIndex TINYINT(1) NOT NULL DEFAULT 1,
  autoSummary TINYINT(1) NOT NULL DEFAULT 0, embeddingEnabled TINYINT(1) NOT NULL DEFAULT 0, defaultCategoryId INT NULL,
  retentionDays INT NULL, updatedBy INT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];
const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'doc_%'");
  const k = await c.query("SHOW TABLES LIKE 'documents'");
  const kb = await c.query("SHOW TABLES LIKE 'knowledge_base'");
  console.log("Tables:", [...t, ...k, ...kb].map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
