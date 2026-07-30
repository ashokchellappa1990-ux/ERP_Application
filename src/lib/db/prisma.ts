import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires a driver adapter for direct connections. The MariaDB adapter
// also drives MySQL. Next.js loads .env automatically, so these vars are
// available server-side. allowPublicKeyRetrieval lets the mariadb driver complete
// MySQL 8's caching_sha2_password handshake over a local (non-TLS) connection.
const adapter = new PrismaMariaDb({
  host: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "onepos",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

// Reuse one PrismaClient across hot reloads in dev (Next.js re-evaluates modules),
// otherwise every reload opens a new connection pool and exhausts the server.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
