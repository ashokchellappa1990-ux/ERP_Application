import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires a driver adapter for direct connections. The MariaDB adapter
// also drives MySQL. Next.js loads .env automatically, so these vars are
// available server-side. allowPublicKeyRetrieval lets the mariadb driver complete
// MySQL 8's caching_sha2_password handshake over a local (non-TLS) connection.
// One-time diagnostic (no secrets — presence/host only) to confirm the
// deployment platform is actually exposing these console-configured env vars
// to the SSR runtime. Safe to remove once a deploy target's env wiring is confirmed.
console.error(
  "[prisma:init] DB_SERVER=%s DB_PORT=%s DB_NAME=%s DB_USER_set=%s DB_PASSWORD_set=%s NODE_ENV=%s",
  process.env.DB_SERVER ?? "(unset)",
  process.env.DB_PORT ?? "(unset)",
  process.env.DB_NAME ?? "(unset)",
  process.env.DB_USER ? "yes" : "no",
  process.env.DB_PASSWORD ? "yes" : "no",
  process.env.NODE_ENV,
);

const adapter = new PrismaMariaDb({
  host: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "onepos",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Kept small in production: on serverless (Vercel), every concurrent
  // invocation/cold start opens its own pool, so a handful of simultaneous
  // requests can multiply this by dozens of lambda instances and exhaust a
  // small RDS instance's max_connections. Local dev is a single long-lived
  // process (one pool, not multiplied across lambdas), so a limit this tight
  // caused real pool-exhaustion failures during ordinary use — a single page
  // load here easily fires 5-7 parallel GETs, and with several browser tabs
  // open against the same dev server a limit of 2 could starve a POST for a
  // connection entirely (a distinct failure mode from Prisma's own
  // interactive-transaction timeout — this happens before the transaction
  // even starts). idleTimeout releases unused connections quickly instead of
  // holding them open across invocations.
  connectionLimit: process.env.NODE_ENV === "production" ? 2 : 10,
  idleTimeout: 15,
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
