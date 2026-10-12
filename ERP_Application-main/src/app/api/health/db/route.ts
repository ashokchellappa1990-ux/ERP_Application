import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/health/db — verifies the app can reach MySQL (onepos).
// Visit http://localhost:3000/api/health/db after the server is configured.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    const users = await prisma.user.count();
    return NextResponse.json({
      status: "ok",
      database: process.env.DB_NAME ?? "onepos",
      server: `${process.env.DB_SERVER ?? "localhost"}:${process.env.DB_PORT ?? "3306"}`,
      counts: { users },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Unknown database error",
        hint: "Check that MySQL is running on port 3306, the onepos database & onepos_app user exist, and .env credentials are correct.",
      },
      { status: 503 },
    );
  }
}
