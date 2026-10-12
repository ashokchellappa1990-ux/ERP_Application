import { NextResponse } from "next/server";
import { getSessionToken, getSessionUser, revokeSession, requestMeta, SESSION_COOKIE } from "@/lib/auth/session";
import { logActivity } from "@/lib/auth/activity";

// POST /api/auth/logout — revoke the session & clear the cookie.
export async function POST(req: Request) {
  const { ip, userAgent } = requestMeta(req);
  const token = getSessionToken();
  const user = await getSessionUser();

  if (token) await revokeSession(token);
  if (user) {
    await logActivity({ userId: user.id, email: user.email, action: "logout", status: "success", ip, userAgent });
  }

  const res = NextResponse.json({ ok: true, message: "Signed out." });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
