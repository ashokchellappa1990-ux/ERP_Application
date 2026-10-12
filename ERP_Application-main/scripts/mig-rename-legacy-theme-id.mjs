import mariadb from "mariadb";

/** Product rebrand: the "oasys" theme preset id was renamed to "oneerp"
 *  (src/lib/themes.ts). This brings the DB column default + any existing rows
 *  into sync so already-provisioned tenants keep their selected theme instead
 *  of silently falling back to the app's default theme. */
async function main() {
  const conn = await mariadb.createConnection({
    host: process.env.DB_SERVER ?? process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await conn.query("ALTER TABLE theme_settings MODIFY COLUMN theme VARCHAR(30) NOT NULL DEFAULT 'oneerp'");
  const res = await conn.query("UPDATE theme_settings SET theme = 'oneerp' WHERE theme = 'oasys'");
  console.log(`theme_settings: default -> 'oneerp', ${res.affectedRows} row(s) migrated 'oasys' -> 'oneerp'`);
  await conn.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
