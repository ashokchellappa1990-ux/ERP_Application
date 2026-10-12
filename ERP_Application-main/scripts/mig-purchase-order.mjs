import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });
const S = [
`CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  poNo VARCHAR(40) NOT NULL, poDate VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  supplierId INT NULL, supplier VARCHAR(200) NULL, supplierGstin VARCHAR(20) NULL, supplierContact VARCHAR(120) NULL, supplierRef VARCHAR(80) NULL,
  quotationNo VARCHAR(60) NULL, quotationDate VARCHAR(20) NULL, buyer VARCHAR(120) NULL, purchaseType VARCHAR(20) NOT NULL DEFAULT 'Inventory',
  expectedDeliveryDate VARCHAR(20) NULL, warehouse VARCHAR(120) NULL, deliveryAddress VARCHAR(400) NULL, shippingMode VARCHAR(20) NULL, freightPaidBy VARCHAR(20) NULL,
  paymentTerms VARCHAR(120) NULL, creditDays INT NULL, dueDate VARCHAR(20) NULL, currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  gstApplicable TINYINT(1) NOT NULL DEFAULT 1, reverseCharge TINYINT(1) NOT NULL DEFAULT 0, interState TINYINT(1) NOT NULL DEFAULT 0,
  taxableAmount DECIMAL(18,2) NOT NULL DEFAULT 0, cgst DECIMAL(18,2) NOT NULL DEFAULT 0, sgst DECIMAL(18,2) NOT NULL DEFAULT 0, igst DECIMAL(18,2) NOT NULL DEFAULT 0, cess DECIMAL(18,2) NOT NULL DEFAULT 0, gstAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  additionalDiscount DECIMAL(18,2) NOT NULL DEFAULT 0, freight DECIMAL(18,2) NOT NULL DEFAULT 0, loading DECIMAL(18,2) NOT NULL DEFAULT 0, packing DECIMAL(18,2) NOT NULL DEFAULT 0, insurance DECIMAL(18,2) NOT NULL DEFAULT 0, otherCharges DECIMAL(18,2) NOT NULL DEFAULT 0, roundOff DECIMAL(9,2) NOT NULL DEFAULT 0,
  totalOrderValue DECIMAL(18,2) NOT NULL DEFAULT 0, netAmount DECIMAL(18,2) NOT NULL DEFAULT 0, itemCount INT NOT NULL DEFAULT 0,
  approvedBy INT NULL, approvedByName VARCHAR(160) NULL, approvedAt DATETIME NULL, approvalNote VARCHAR(300) NULL, issuedAt DATETIME NULL, cancelledAt DATETIME NULL, cancelReason VARCHAR(300) NULL,
  remarks VARCHAR(500) NULL, internalNotes VARCHAR(500) NULL, termsConditions TEXT NULL,
  createdBy INT NULL, createdByName VARCHAR(160) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  terminalId INT NULL, terminalSessionId INT NULL, shiftSessionId INT NULL, cashierUserId INT NULL, deviceId VARCHAR(80) NULL, transactionSource VARCHAR(20) NULL, dayOpeningId INT NULL, dayClosingId INT NULL,
  UNIQUE KEY uq_po (tenantId, poNo), KEY ix_po_status (tenantId, status), KEY ix_po_date (tenantId, branchId, poDate), KEY ix_po_supplier (tenantId, supplier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY, purchaseOrderId INT NOT NULL, productId INT NULL, productName VARCHAR(250) NOT NULL, sku VARCHAR(60) NULL, hsn VARCHAR(20) NULL, uom VARCHAR(40) NULL,
  qty DECIMAL(18,3) NOT NULL, rate DECIMAL(18,2) NOT NULL DEFAULT 0, taxPct DECIMAL(9,2) NULL, taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0, discPct DECIMAL(9,2) NULL, discAmount DECIMAL(18,2) NOT NULL DEFAULT 0, lineValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  expectedDate VARCHAR(20) NULL, receivedQty DECIMAL(18,3) NOT NULL DEFAULT 0, remarks VARCHAR(300) NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_poi_order (purchaseOrderId), KEY ix_poi_product (productId),
  CONSTRAINT fk_poi_order FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY, purchaseOrderId INT NOT NULL, docType VARCHAR(20) NOT NULL DEFAULT 'quotation', fileName VARCHAR(200) NOT NULL, fileUrl LONGTEXT NOT NULL, fileType VARCHAR(80) NULL, size INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_poa_order (purchaseOrderId),
  CONSTRAINT fk_poa_order FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];
const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  // Add the seqPO counter column to purchase_settings if it doesn't exist.
  const col = await c.query("SHOW COLUMNS FROM `purchase_settings` LIKE 'seqPO'");
  if (!col.length) await c.query("ALTER TABLE `purchase_settings` ADD COLUMN `seqPO` INT NOT NULL DEFAULT 0 AFTER `seqAsset`");
  const t = await c.query("SHOW TABLES LIKE 'purchase_order%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]), "| seqPO added:", !col.length);
} finally { c.release(); await pool.end(); }
console.log("DONE");
