import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validation/loginSchema";
import { createSession, requestMeta, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { logActivity } from "@/lib/auth/activity";
import { toPublicUser } from "@/lib/auth/user";

// POST /api/auth/login — authenticate by email/username + password, open a session.
export async function POST(req: Request) {
  const { ip, userAgent } = requestMeta(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Enter your credentials." },
      { status: 422 },
    );
  }
  const { identifier, password, remember } = parsed.data;
  const id = identifier.trim();

  // Look up by email OR username (case-insensitive email).
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: id.toLowerCase() }, { username: id }] },
  });

  // Invalid credentials — never reveal which part was wrong.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await logActivity({
      userId: user?.id ?? null,
      email: user?.email ?? id,
      action: "login_failed",
      status: "failure",
      reason: user ? "Wrong password" : "Unknown account",
      ip,
      userAgent,
    });
    return NextResponse.json(
      { ok: false, message: "Invalid email/username or password." },
      { status: 401 },
    );
  }

  // Account state gate (no OTP step — only suspended / inactive accounts are blocked).
  if (user.status === "suspended" || user.status === "inactive" || !user.isActive) {
    await logActivity({ userId: user.id, email: user.email, action: "login_failed", status: "failure", reason: `Account ${user.status}`, ip, userAgent });
    return NextResponse.json(
      { ok: false, message: "Your account is not active. Contact your administrator." },
      { status: 403 },
    );
  }

  // Success — open a session, record last login, audit it.
  const { token } = await createSession(user.id, { ip, userAgent, remember });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });
  await logActivity({ userId: user.id, email: user.email, action: "login", status: "success", ip, userAgent });

  const res = NextResponse.json({
    ok: true,
    message: "Signed in.",
    redirect: "/dashboard",
    user: toPublicUser(user),
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(!!remember));
  return res;
}
