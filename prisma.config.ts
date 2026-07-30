import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config. Node 20.6+ / 24 ships
// process.loadEnvFile() which reads .env into process.env.
try {
  process.loadEnvFile();
} catch {
  // .env may be absent in CI / production where env vars are injected directly.
}

const {
  DB_SERVER = "localhost",
  DB_PORT = "3306",
  DB_NAME = "onepos",
  DB_USER = "",
  DB_PASSWORD = "",
} = process.env;

// Prisma Migrate / Introspect connect via this MySQL URL. User & password are
// URL-encoded so special characters (@, #, …) don't break the connection string.
const url =
  `mysql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}` +
  `@${DB_SERVER}:${DB_PORT}/${DB_NAME}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
  migrations: { seed: "tsx prisma/seed.ts" },
});
