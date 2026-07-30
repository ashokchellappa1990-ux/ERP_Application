import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PLATFORM_COOKIE, platformCookieOptions, createPlatformSession, verifyPlatformCredentials, ensurePlatformBootstrap } from "@/lib/platform/session";

// POST /api/platform/auth/login — { email, password, remember? }
export async function POST(req: Request) {
  await ensurePlatformBootstrap(); // seed roles + owner on first run
  let body: { email?: string; password?: string; remember?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 }); }
  const email = (body.email ?? "").trim(); const password = body.password ?? "";
  if (!email || !password) return NextResponse.json({ ok: false, message: "Email and password are required." }, { status: 400 });

  const user = await verifyPlatformCredentials(email, password);
  if (!user) return NextResponse.json({ ok: false, message: "Invalid credentials or inactive account." }, { status: 401 });

  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0].trim() : "") || req.headers.get("x-real-ip") || "127.0.0.1";
  const { token } = await createPlatformSession(user.id, { ip, userAgent: (req.headers.get("user-agent") || "").slice(0, 300), remember: !!body.remember });
  await prisma.platformUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
  await prisma.platformAudit.create({ data: { entityType: "Auth", action: "Platform Login", byUser: user.id, byName: user.name } }).catch(() => {});

  const res = NextResponse.json({ ok: true, message: "Signed in." });
  res.cookies.set(PLATFORM_COOKIE, token, platformCookieOptions(!!body.remember));
  return res;
}
