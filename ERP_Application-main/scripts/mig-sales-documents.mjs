// Sales Quotation + Sales Order — one `sales_documents` table (docType discriminator)
// + items + attachments, and two running counters on sales_settings. No GL / stock.
//   node --env-file=.env scripts/mig-sales-documents.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS sales_documents (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  docType VARCHAR(20) NOT NULL, docNo VARCHAR(40) NOT NULL, docDate VARCHAR(20) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'Draft',
  customerId INT NULL, customerName VARCHAR(200) NULL, customerPhone VARCHAR(40) NULL, customerGstin VARCHAR(20) NULL, customerContact VARCHAR(120) NULL, customerRef VARCHAR(80) NULL,
  salesperson VARCHAR(120) NULL, enquiryNo VARCHAR(60) NULL, enquiryDate VARCHAR(20) NULL,
  validUntil VARCHAR(20) NULL, expectedDeliveryDate VARCHAR(20) NULL, warehouse VARCHAR(120) NULL, deliveryAddress VARCHAR(400) NULL, shippingMode VARCHAR(20) NULL,
  paymentTerms VARCHAR(120) NULL, creditDays INT NULL, dueDate VARCHAR(20) NULL, currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  gstApplicable TINYINT(1) NOT NULL DEFAULT 1, reverseCharge TINYINT(1) NOT NULL DEFAULT 0, interState TINYINT(1) NOT NULL DEFAULT 0, gstMode VARCHAR(12) NOT NULL DEFAULT 'exclusive',
  subtotal DECIMAL(18,2) NOT NULL DEFAULT 0, itemDiscount DECIMAL(18,2) NOT NULL DEFAULT 0, additionalDiscount DECIMAL(18,2) NOT NULL DEFAULT 0,
  taxableAmount DECIMAL(18,2) NOT NULL DEFAULT 0, cgst DECIMAL(18,2) NOT NULL DEFAULT 0, sgst DECIMAL(18,2) NOT NULL DEFAULT 0, igst DECIMAL(18,2) NOT NULL DEFAULT 0, gstAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  freight DECIMAL(18,2) NOT NULL DEFAULT 0, loading DECIMAL(18,2) NOT NULL DEFAULT 0, packing DECIMAL(18,2) NOT NULL DEFAULT 0, insurance DECIMAL(18,2) NOT NULL DEFAULT 0, otherCharges DECIMAL(18,2) NOT NULL DEFAULT 0, roundOff DECIMAL(9,2) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0, netAmount DECIMAL(18,2) NOT NULL DEFAULT 0, itemCount INT NOT NULL DEFAULT 0,
  sourceDocType VARCHAR(20) NULL, sourceDocId INT NULL, sourceDocNo VARCHAR(40) NULL,
  convertedToType VARCHAR(20) NULL, convertedToId INT NULL, convertedToNo VARCHAR(40) NULL,
  approvedBy INT NULL, approvedByName VARCHAR(160) NULL, approvedAt DATETIME NULL, approvalNote VARCHAR(300) NULL, issuedAt DATETIME NULL, cancelledAt DATETIME NULL, cancelReason VARCHAR(300) NULL,
  remarks VARCHAR(500) NULL, internalNotes VARCHAR(500) NULL, termsConditions TEXT NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  terminalId INT NULL, terminalSessionId INT NULL, shiftSessionId INT NULL, cashierUserId INT NULL, deviceId VARCHAR(80) NULL, transactionSource VARCHAR(20) NULL, dayOpeningId INT NULL, dayClosingId INT NULL,
  UNIQUE KEY uq_sd (tenantId, docType, docNo), KEY ix_sd_type_status (tenantId, docType, status), KEY ix_sd_date (tenantId, docType, branchId, docDate), KEY ix_sd_customer (tenantId, customerName), KEY ix_sd_source (sourceDocId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS sales_document_items (
  id INT AUTO_INCREMENT PRIMARY KEY, salesDocumentId INT NOT NULL, productId INT NULL, productName VARCHAR(250) NOT NULL, sku VARCHAR(60) NULL, hsn VARCHAR(20) NULL, uom VARCHAR(40) NULL,
  qty DECIMAL(18,3) NOT NULL, mrp DECIMAL(18,2) NULL, rate DECIMAL(18,2) NOT NULL DEFAULT 0, discPct DECIMAL(9,2) NULL, discAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  taxPct DECIMAL(9,2) NULL, taxableValue DECIMAL(18,2) NOT NULL DEFAULT 0, taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0, lineValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  deliveredQty DECIMAL(18,3) NOT NULL DEFAULT 0, expectedDate VARCHAR(20) NULL, remarks VARCHAR(300) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_sdi_doc (salesDocumentId), KEY ix_sdi_product (productId),
  CONSTRAINT fk_sdi_doc FOREIGN KEY (salesDocumentId) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS sales_document_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY, salesDocumentId INT NOT NULL, docType VARCHAR(20) NOT NULL DEFAULT 'attachment', fileName VARCHAR(200) NOT NULL, fileUrl LONGTEXT NOT NULL, fileType VARCHAR(80) NULL, size INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_sda_doc (salesDocumentId),
  CONSTRAINT fk_sda_doc FOREIGN KEY (salesDocumentId) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  for (const col of ["seqQuotation", "seqOrder"]) {
    const has = await c.query(`SHOW COLUMNS FROM \`sales_settings\` LIKE '${col}'`);
    if (!has.length) await c.query(`ALTER TABLE \`sales_settings\` ADD COLUMN \`${col}\` INT NOT NULL DEFAULT 0`);
  }
  const t = await c.query("SHOW TABLES LIKE 'sales_document%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
  console.log("Counters seqQuotation/seqOrder ensured on sales_settings");
} finally { c.release(); await pool.end(); }
console.log("DONE");
