// Enterprise Branch Hierarchy v2.0 — turn the flat `branches` table into an
// unlimited-depth self-referential org hierarchy + add an `entity_types` master.
// Backward compatible: every existing branch becomes a root node (level 1).
//   node --env-file=.env scripts/mig-branch-hierarchy.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });

// Default entity types seeded per tenant. allowChild = whether a node of this
// type may have children (leaf/operating nodes default to false).
const SEED = [
  { code: "HO",        name: "Head Office",         icon: "Building2",   color: "#6366f1", allowChild: 1 },
  { code: "CORP",      name: "Corporate Office",    icon: "Landmark",    color: "#8b5cf6", allowChild: 1 },
  { code: "STATE",     name: "State Office",        icon: "Map",         color: "#0ea5e9", allowChild: 1 },
  { code: "REGION",    name: "Regional Office",     icon: "MapPin",      color: "#06b6d4", allowChild: 1 },
  { code: "BRANCH",    name: "Branch Office",       icon: "GitBranch",   color: "#10b981", allowChild: 1 },
  { code: "SALES",     name: "Sales Office",        icon: "Briefcase",   color: "#14b8a6", allowChild: 1 },
  { code: "DC",        name: "Distribution Centre", icon: "Truck",       color: "#f59e0b", allowChild: 1 },
  { code: "WH",        name: "Warehouse",           icon: "Warehouse",   color: "#eab308", allowChild: 0 },
  { code: "STORE",     name: "Retail Store",        icon: "Store",       color: "#ef4444", allowChild: 0 },
  { code: "FACTORY",   name: "Factory",             icon: "Factory",     color: "#78716c", allowChild: 1 },
  { code: "MFG",       name: "Manufacturing Unit",  icon: "Factory",     color: "#a16207", allowChild: 1 },
  { code: "DARK",      name: "Dark Store",          icon: "PackageOpen", color: "#db2777", allowChild: 0 },
  { code: "PROJECT",   name: "Project Office",      icon: "HardHat",     color: "#0891b2", allowChild: 1 },
  { code: "SERVICE",   name: "Service Centre",      icon: "Wrench",      color: "#f97316", allowChild: 0 },
  { code: "FRANCHISE", name: "Franchise",           icon: "Handshake",   color: "#65a30d", allowChild: 0 },
  { code: "OFFICE",    name: "Office",              icon: "Building",    color: "#64748b", allowChild: 1 },
];

// Map legacy Branch.type strings → entity type name.
const TYPE_MAP = {
  "head office": "Head Office",
  "retail outlet": "Retail Store",
  "warehouse outlet": "Warehouse",
  "warehouse": "Warehouse",
  "franchise": "Franchise",
  "corporate office": "Corporate Office",
  "distribution centre": "Distribution Centre",
  "factory": "Factory",
};

async function addCol(c, table, col, ddl) {
  const has = await c.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
  if (!has.length) { await c.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`); return true; }
  return false;
}

const c = await pool.getConnection();
try {
  // 1) entity_types master
  await c.query(`CREATE TABLE IF NOT EXISTS entity_types (
    id INT AUTO_INCREMENT PRIMARY KEY, tenantId INT NOT NULL,
    code VARCHAR(40) NOT NULL, name VARCHAR(80) NOT NULL, description VARCHAR(300) NULL,
    icon VARCHAR(40) NULL, color VARCHAR(20) NULL, allowChild TINYINT(1) NOT NULL DEFAULT 1,
    displayOrder INT NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'active',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_et_tenant (tenantId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // 2) branch hierarchy columns (idempotent)
  const added = [];
  for (const [col, ddl] of [
    ["entityTypeId",          "`entityTypeId` INT NULL AFTER `type`"],
    ["parentBranchId",        "`parentBranchId` INT NULL AFTER `entityTypeId`"],
    ["hierarchyLevel",        "`hierarchyLevel` INT NOT NULL DEFAULT 1 AFTER `parentBranchId`"],
    ["hierarchyPath",         "`hierarchyPath` VARCHAR(500) NULL AFTER `hierarchyLevel`"],
    ["displayOrder",          "`displayOrder` INT NOT NULL DEFAULT 1 AFTER `hierarchyPath`"],
    ["allowChild",            "`allowChild` TINYINT(1) NOT NULL DEFAULT 1 AFTER `displayOrder`"],
    ["remarks",               "`remarks` VARCHAR(500) NULL AFTER `allowChild`"],
    ["latitude",              "`latitude` DECIMAL(10,7) NULL AFTER `remarks`"],
    ["longitude",             "`longitude` DECIMAL(10,7) NULL AFTER `latitude`"],
    ["defaultCostCenterId",   "`defaultCostCenterId` INT NULL AFTER `longitude`"],
    ["defaultProfitCenterId", "`defaultProfitCenterId` INT NULL AFTER `defaultCostCenterId`"],
  ]) { if (await addCol(c, "branches", col, ddl)) added.push(col); }

  // indexes (ignore if they already exist)
  for (const [name, cols] of [["ix_branch_parent", "parentBranchId"], ["ix_branch_entity", "entityTypeId"]]) {
    const idx = await c.query(`SHOW INDEX FROM \`branches\` WHERE Key_name = '${name}'`);
    if (!idx.length) await c.query(`ALTER TABLE \`branches\` ADD INDEX \`${name}\` (\`${cols}\`)`);
  }

  // 3) seed entity types for every tenant that has businesses or branches (skip if already seeded)
  const tenants = await c.query("SELECT DISTINCT tenantId FROM businesses UNION SELECT DISTINCT tenantId FROM branches");
  let seededTenants = 0;
  for (const { tenantId } of tenants) {
    const existing = await c.query("SELECT COUNT(*) AS n FROM entity_types WHERE tenantId = ?", [tenantId]);
    if (Number(existing[0].n) > 0) continue;
    let order = 1;
    for (const s of SEED) {
      await c.query(
        "INSERT INTO entity_types (tenantId, code, name, icon, color, allowChild, displayOrder, status) VALUES (?,?,?,?,?,?,?, 'active')",
        [tenantId, s.code, s.name, s.icon, s.color, s.allowChild, order++]
      );
    }
    seededTenants++;
  }

  // 4) backfill existing branches → roots (level 1, path = own id) + map type → entityTypeId
  await c.query("UPDATE branches SET hierarchyLevel = 1, hierarchyPath = CAST(id AS CHAR) WHERE hierarchyPath IS NULL OR hierarchyPath = ''");
  const branches = await c.query("SELECT id, tenantId, type, entityTypeId FROM branches");
  const etByTenant = new Map(); // tenantId -> Map(nameLower -> {id, allowChild})
  let mapped = 0;
  for (const b of branches) {
    if (b.entityTypeId) continue;
    if (!etByTenant.has(b.tenantId)) {
      const rows = await c.query("SELECT id, name, allowChild FROM entity_types WHERE tenantId = ?", [b.tenantId]);
      etByTenant.set(b.tenantId, new Map(rows.map((r) => [r.name.toLowerCase(), { id: r.id, allowChild: r.allowChild }])));
    }
    const et = etByTenant.get(b.tenantId);
    const wanted = TYPE_MAP[String(b.type || "").trim().toLowerCase()] || "Branch Office";
    const hit = et.get(wanted.toLowerCase()) || et.get("branch office") || [...et.values()][0];
    if (hit) { await c.query("UPDATE branches SET entityTypeId = ?, allowChild = ? WHERE id = ?", [hit.id, hit.allowChild, b.id]); mapped++; }
  }

  const et = await c.query("SELECT COUNT(*) AS n FROM entity_types");
  console.log("Columns added:", added.length ? added.join(", ") : "(all present)");
  console.log("Entity types total:", Number(et[0].n), "| tenants seeded:", seededTenants);
  console.log("Existing branches mapped to an entity type:", mapped);
} finally { c.release(); await pool.end(); }
console.log("DONE");
