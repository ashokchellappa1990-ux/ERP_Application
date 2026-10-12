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
  // Kept modest in production: on serverless (Vercel/Amplify), every concurrent
  // invocation/cold start opens its own pool, so this multiplies by however many
  // lambda instances are warm at once against a small RDS instance's
  // max_connections (60 on db.t4g.micro) — so this can't just be raised freely.
  // But a limit of 2 was tighter than any single request here can actually use:
  // several routes (e.g. the gate-entry list) fan out 3-6 queries per
  // Promise.all batch, so even ONE request's own internal concurrency
  // exhausted a pool of 2 and stalled for the full 10s pool-acquire timeout —
  // confirmed in production logs ("pool connections: active=2 idle=0 limit=2")
  // with no other traffic in flight. 5 clears that self-inflicted bottleneck
  // while still keeping total connections (5 × a handful of concurrent lambdas)
  // well under the RDS ceiling. Local dev is a single long-lived process (one
  // pool, never multiplied across lambdas), so it can afford to stay higher.
  // idleTimeout releases unused connections quickly instead of holding them
  // open across invocations.
  connectionLimit: process.env.NODE_ENV === "production" ? 5 : 10,
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
