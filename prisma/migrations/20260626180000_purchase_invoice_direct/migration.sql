-- Purchase Invoice: common doc for GRN-based + direct vendor bill
ALTER TABLE `purchase_invoice`
  ADD COLUMN `invoiceType` VARCHAR(10) NOT NULL DEFAULT 'GRN',
  ADD COLUMN `grnRef` VARCHAR(120) NULL;

-- Direct-bill lines may be free-text (no product) + carry an HSN.
ALTER TABLE `purchase_invoice_items`
  MODIFY COLUMN `productId` INTEGER NULL,
  ADD COLUMN `hsn` VARCHAR(20) NULL;
