// Transport & Vehicle Operations (Phase 1) — masters, Dispatch Planning, the shared
// Dispatch Execution engine, the Gate/Weighment/Loading/Gate-Exit physical workflow,
// Delivery Challan, Vehicle Movement History, Transport Cost capture, and the
// Dispatch Configuration singleton. This module manages ONLY the physical movement
// of vehicles and dispatch execution — it never writes InventoryLedger/journal_entries
// itself (Stock Transfer dispatches call the existing postDispatch(); Customer
// dispatches call the existing createSaleTx() — see src/lib/transport/dispatchExecution.ts).
//   node --env-file=.env scripts/mig-transport.mjs
import mariadb from "mariadb";

const pool = mariadb.createPool({
  host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});
async function run(sql) { const c = await pool.getConnection(); try { await c.query(sql); } finally { c.release(); } }

async function main() {
  // ---------------------------------------------------------------- masters
  await run(`CREATE TABLE IF NOT EXISTS vehicle_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    vehicleNo VARCHAR(40) NOT NULL,
    vehicleType VARCHAR(60) NULL,
    capacity DECIMAL(18,3) NOT NULL DEFAULT 0,
    capacityUnit VARCHAR(20) NULL,
    transportCompanyId INT NULL,
    ownerType VARCHAR(16) NOT NULL DEFAULT 'Own',
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_vehicle_no (tenantId, vehicleNo),
    KEY idx_vehicle_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS driver_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    name VARCHAR(150) NOT NULL,
    licenseNo VARCHAR(60) NULL,
    licenseExpiry VARCHAR(20) NULL,
    phone VARCHAR(20) NULL,
    transportCompanyId INT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    KEY idx_driver_status (tenantId, status),
    KEY idx_driver_company (transportCompanyId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS transport_company (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    contactPerson VARCHAR(150) NULL,
    phone VARCHAR(20) NULL,
    gstin VARCHAR(20) NULL,
    address VARCHAR(400) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_transport_co_code (tenantId, code),
    KEY idx_transport_co_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS route_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sourceBranchId INT NULL,
    destinationBranchId INT NULL,
    distanceKm DECIMAL(18,2) NULL,
    estimatedHours DECIMAL(10,2) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_route_code (tenantId, code),
    KEY idx_route_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS loading_bay (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    warehouse VARCHAR(120) NULL,
    capacity DECIMAL(18,3) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_loading_bay_code (tenantId, code),
    KEY idx_loading_bay_branch (tenantId, branchId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS weighbridge_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(200) NULL,
    capacity DECIMAL(18,3) NULL,
    calibrationDueDate VARCHAR(20) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_weighbridge_code (tenantId, code),
    KEY idx_weighbridge_branch (tenantId, branchId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ 6 transport masters ready");

  // ------------------------------------------------------- dispatch planning
  await run(`CREATE TABLE IF NOT EXISTS dispatch_planning (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    planningNo VARCHAR(40) NOT NULL,
    planningDate VARCHAR(20) NOT NULL,
    dispatchSource VARCHAR(24) NOT NULL DEFAULT 'Sales Order',
    referenceType VARCHAR(30) NULL,
    referenceId INT NULL,
    referenceNo VARCHAR(60) NULL,
    warehouse VARCHAR(120) NULL,
    expectedDispatchDate VARCHAR(20) NULL,
    priority VARCHAR(12) NOT NULL DEFAULT 'Normal',
    transportMode VARCHAR(30) NULL,
    estimatedWeight DECIMAL(18,3) NOT NULL DEFAULT 0,
    estimatedVolume DECIMAL(18,3) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft',
    approvedBy INT NULL,
    approvedByName VARCHAR(160) NULL,
    approvedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    cancelReason VARCHAR(300) NULL,
    createdBy INT NULL,
    createdByName VARCHAR(160) NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_planning_no (tenantId, planningNo),
    KEY idx_planning_status (tenantId, status),
    KEY idx_planning_ref (referenceType, referenceId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS dispatch_planning_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    planningId INT NOT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    batchNo VARCHAR(80) NULL,
    allocationLotId INT NULL,
    qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    uom VARCHAR(20) NULL,
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_planning_item_hdr FOREIGN KEY (planningId) REFERENCES dispatch_planning(id) ON DELETE CASCADE,
    KEY idx_planning_item_hdr (planningId),
    KEY idx_planning_item_prod (tenantId, productId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ dispatch_planning, dispatch_planning_items ready");

  // ------------------------------------------------------ dispatch execution
  await run(`CREATE TABLE IF NOT EXISTS dispatch_execution (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    docNo VARCHAR(40) NOT NULL,
    docType VARCHAR(24) NOT NULL DEFAULT 'Customer',
    docDate VARCHAR(20) NOT NULL,
    dispatchPlanningId INT NULL,
    sourceRefType VARCHAR(30) NULL,
    sourceRefId INT NULL,
    sourceRefNo VARCHAR(60) NULL,
    partyType VARCHAR(20) NULL,
    partyId INT NULL,
    partyName VARCHAR(200) NULL,
    deliveryAddress VARCHAR(400) NULL,
    warehouse VARCHAR(120) NULL,
    transportCompanyId INT NULL,
    vehicleId INT NULL,
    driverId INT NULL,
    vehicleGateEntryId INT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft',
    isPartial TINYINT(1) NOT NULL DEFAULT 0,
    totalQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    completedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    cancelReason VARCHAR(300) NULL,
    createdBy INT NULL,
    createdByName VARCHAR(160) NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_execution_no (tenantId, docType, docNo),
    KEY idx_execution_status (tenantId, docType, status),
    KEY idx_execution_source (sourceRefType, sourceRefId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS dispatch_execution_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    executionId INT NOT NULL,
    productId INT NOT NULL,
    productName VARCHAR(250) NOT NULL,
    sku VARCHAR(60) NULL,
    uom VARCHAR(20) NULL,
    batchNo VARCHAR(80) NULL,
    mfgDate VARCHAR(20) NULL,
    expiryDate VARCHAR(20) NULL,
    allocationLotId INT NULL,
    orderedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    dispatchedQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    rate DECIMAL(18,2) NULL,
    value DECIMAL(18,2) NOT NULL DEFAULT 0,
    qrCode VARCHAR(80) NULL,
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_execution_item_hdr FOREIGN KEY (executionId) REFERENCES dispatch_execution(id) ON DELETE CASCADE,
    KEY idx_execution_item_hdr (executionId),
    KEY idx_execution_item_prod (tenantId, productId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ dispatch_execution, dispatch_execution_items ready");

  // ------------------------------------------------ gate / weighment / loading
  await run(`CREATE TABLE IF NOT EXISTS vehicle_gate_entry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    gateEntryNo VARCHAR(40) NOT NULL,
    vehicleId INT NOT NULL,
    driverId INT NULL,
    transportCompanyId INT NULL,
    dispatchPlanningId INT NULL,
    dispatchExecutionId INT NULL,
    dispatchType VARCHAR(24) NULL,
    referenceNo VARCHAR(60) NULL,
    arrivalTime DATETIME NULL,
    securityOfficer VARCHAR(160) NULL,
    remarks TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Waiting',
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    UNIQUE KEY uq_gate_entry_no (tenantId, gateEntryNo),
    KEY idx_gate_entry_status (tenantId, status),
    KEY idx_gate_entry_execution (dispatchExecutionId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS pre_loading_weighment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    weighmentNo VARCHAR(40) NOT NULL,
    gateEntryId INT NOT NULL,
    vehicleId INT NOT NULL,
    tareWeight DECIMAL(18,3) NOT NULL DEFAULT 0,
    weighDate VARCHAR(20) NULL,
    weighTime VARCHAR(10) NULL,
    operator VARCHAR(160) NULL,
    weighbridgeId INT NULL,
    photoUrl VARCHAR(400) NULL,
    remarks TEXT NULL,
    createdBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pre_weigh_gate FOREIGN KEY (gateEntryId) REFERENCES vehicle_gate_entry(id) ON DELETE CASCADE,
    UNIQUE KEY uq_pre_weigh_no (tenantId, weighmentNo),
    KEY idx_pre_weigh_gate (gateEntryId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS loading_confirmation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    loadingNo VARCHAR(40) NOT NULL,
    gateEntryId INT NOT NULL,
    warehouse VARCHAR(120) NULL,
    loadingBayId INT NULL,
    supervisor VARCHAR(160) NULL,
    loadingStart DATETIME NULL,
    loadingEnd DATETIME NULL,
    packages INT NOT NULL DEFAULT 0,
    pallets INT NOT NULL DEFAULT 0,
    batchNo VARCHAR(80) NULL,
    serialNumber VARCHAR(120) NULL,
    sealNumber VARCHAR(60) NULL,
    remarks TEXT NULL,
    createdBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_loading_conf_gate FOREIGN KEY (gateEntryId) REFERENCES vehicle_gate_entry(id) ON DELETE CASCADE,
    UNIQUE KEY uq_loading_no (tenantId, loadingNo),
    KEY idx_loading_conf_gate (gateEntryId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS post_loading_weighment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    gateEntryId INT NOT NULL,
    grossWeight DECIMAL(18,3) NOT NULL DEFAULT 0,
    tareWeight DECIMAL(18,3) NOT NULL DEFAULT 0,
    netWeight DECIMAL(18,3) NOT NULL DEFAULT 0,
    weighDate VARCHAR(20) NULL,
    operator VARCHAR(160) NULL,
    toleranceExceeded TINYINT(1) NOT NULL DEFAULT 0,
    approvalStatus VARCHAR(16) NOT NULL DEFAULT 'NotRequired',
    approvedBy INT NULL,
    approvedByName VARCHAR(160) NULL,
    approvedAt DATETIME NULL,
    remarks TEXT NULL,
    createdBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_weigh_gate FOREIGN KEY (gateEntryId) REFERENCES vehicle_gate_entry(id) ON DELETE CASCADE,
    UNIQUE KEY uq_post_weigh_gate (gateEntryId),
    KEY idx_post_weigh_approval (tenantId, approvalStatus)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS gate_exit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    gateExitNo VARCHAR(40) NOT NULL,
    gateEntryId INT NOT NULL,
    vehicleId INT NOT NULL,
    exitTime DATETIME NULL,
    securityOfficer VARCHAR(160) NULL,
    sealVerified TINYINT(1) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    createdBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gate_exit_gate FOREIGN KEY (gateEntryId) REFERENCES vehicle_gate_entry(id) ON DELETE CASCADE,
    UNIQUE KEY uq_gate_exit_no (tenantId, gateExitNo),
    UNIQUE KEY uq_gate_exit_gate (gateEntryId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ vehicle_gate_entry, pre_loading_weighment, loading_confirmation, post_loading_weighment, gate_exit ready");

  // --------------------------------------------------- DC / history / cost
  await run(`CREATE TABLE IF NOT EXISTS delivery_challan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    dcNo VARCHAR(40) NOT NULL,
    dcDate VARCHAR(20) NOT NULL,
    dispatchExecutionId INT NOT NULL,
    customerId INT NULL,
    customerName VARCHAR(200) NULL,
    deliveryAddress VARCHAR(400) NULL,
    totalQty DECIMAL(18,3) NOT NULL DEFAULT 0,
    totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'Generated',
    printedCount INT NOT NULL DEFAULT 0,
    generatedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    remarks TEXT NULL,
    createdBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dc_no (tenantId, dcNo),
    KEY idx_dc_execution (dispatchExecutionId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS vehicle_movement_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    vehicleId INT NOT NULL,
    dispatchExecutionId INT NULL,
    gateEntryId INT NULL,
    eventType VARCHAR(24) NOT NULL,
    eventAt DATETIME NOT NULL,
    actorUserId INT NULL,
    actorName VARCHAR(160) NULL,
    remarks VARCHAR(300) NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_movement_vehicle (tenantId, vehicleId, eventAt),
    KEY idx_movement_execution (dispatchExecutionId),
    KEY idx_movement_gate (gateEntryId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS transport_cost (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    dispatchExecutionId INT NOT NULL,
    transportCompanyId INT NULL,
    vehicleId INT NULL,
    distance DECIMAL(18,2) NOT NULL DEFAULT 0,
    freightCharge DECIMAL(18,2) NOT NULL DEFAULT 0,
    loadingCharge DECIMAL(18,2) NOT NULL DEFAULT 0,
    unloadingCharge DECIMAL(18,2) NOT NULL DEFAULT 0,
    fuelCharge DECIMAL(18,2) NOT NULL DEFAULT 0,
    tollCharge DECIMAL(18,2) NOT NULL DEFAULT 0,
    driverAllowance DECIMAL(18,2) NOT NULL DEFAULT 0,
    helperAllowance DECIMAL(18,2) NOT NULL DEFAULT 0,
    otherCharges DECIMAL(18,2) NOT NULL DEFAULT 0,
    discount DECIMAL(18,2) NOT NULL DEFAULT 0,
    gstAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalCost DECIMAL(18,2) NOT NULL DEFAULT 0,
    postedToFinance TINYINT(1) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    createdBy INT NULL,
    updatedBy INT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_transport_cost_execution (tenantId, dispatchExecutionId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ delivery_challan, vehicle_movement_history, transport_cost ready");

  // ----------------------------------------------------------- config
  await run(`CREATE TABLE IF NOT EXISTS dispatch_configuration (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    businessId INT NULL,
    branchId INT NULL,
    config JSON NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dispatch_config_scope (tenantId, businessId, branchId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("✓ dispatch_configuration ready");
}
main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
