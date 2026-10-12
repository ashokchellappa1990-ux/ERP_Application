import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export const SESSION_COOKIE = "pos_session";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Random opaque session token (96 hex chars). */
export function newToken(): string {
  return randomBytes(48).toString("hex");
}

export function sessionMaxAgeSeconds(remember: boolean): number {
  return (remember ? 30 : 1) * 24 * 60 * 60;
}

/** httpOnly cookie attributes for the session token. */
export function sessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(remember),
  };
}

/** Pull client IP + user-agent from the request (for sessions & audit logs). */
export function requestMeta(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    (xff ? xff.split(",")[0].trim() : "") ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
  return { ip, userAgent };
}

/** Create a DB-backed session row and return its token. */
export async function createSession(
  userId: number,
  opts: { ip?: string; userAgent?: string; remember?: boolean },
) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + (opts.remember ? 30 : 1) * DAY_MS);
  await prisma.session.create({
    data: { token, userId, ipAddress: opts.ip, userAgent: opts.userAgent, expiresAt },
  });
  return { token, expiresAt };
}

/** Resolve the current user from the session cookie (or null). */
export async function getSessionUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  // Best-effort "last seen" touch — never blocks the request.
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return session.user;
}

export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

/** Revoke a session (logout) — keeps the row for audit, sets revokedAt. */
export async function revokeSession(token: string) {
  await prisma.session.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
