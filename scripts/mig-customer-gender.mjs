// Add the `gender` column to customers (dob/anniversary already exist). Idempotent.
//   node --env-file=.env scripts/mig-customer-gender.mjs
import mariadb from "mariadb";
const pool = mariadb.createPool({ host: process.env.DB_SERVER ?? "localhost", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? "onepos", user: process.env.DB_USER, password: process.env.DB_PASSWORD, allowPublicKeyRetrieval: true, connectionLimit: 3 });
const c = await pool.getConnection();
try {
  const has = await c.query("SHOW COLUMNS FROM `customers` LIKE 'gender'");
  if (!has.length) { await c.query("ALTER TABLE `customers` ADD COLUMN `gender` VARCHAR(20) NULL AFTER `anniversary`"); console.log("Added customers.gender"); }
  else console.log("customers.gender already present");
} finally { c.release(); await pool.end(); }
console.log("DONE");
