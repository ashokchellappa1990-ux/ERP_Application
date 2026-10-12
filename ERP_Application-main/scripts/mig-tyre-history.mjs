// Tyre Management — append-only lifecycle event log (tyre-scoped timeline,
// parallel to VehicleMovementHistory which is shaped for vehicle-dispatch
// events and doesn't fit tyre semantics).
//   node --env-file=.env scripts/mig-tyre-history.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

const S = [
`CREATE TABLE IF NOT EXISTS tyre_movement_history (
  id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL, businessId INT NULL, branchId INT NULL,
  tyreId INT NOT NULL, vehicleId INT NULL, eventType VARCHAR(24) NOT NULL, eventAt DATETIME NOT NULL,
  positionCode VARCHAR(20) NULL, odometer DECIMAL(12,2) NULL, vendorId INT NULL, cost DECIMAL(18,2) NULL,
  refEntity VARCHAR(30) NULL, refId INT NULL,
  actorUserId INT NULL, actorName VARCHAR(160) NULL, remarks VARCHAR(300) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_tmh_tyre (tenantId, tyreId, eventAt), KEY ix_tmh_vehicle (tenantId, vehicleId, eventAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const c = await pool.getConnection();
try {
  for (const sql of S) await c.query(sql);
  const t = await c.query("SHOW TABLES LIKE 'tyre_%'");
  console.log("Tables:", t.map((r) => Object.values(r)[0]));
} finally { c.release(); await pool.end(); }
console.log("DONE");
