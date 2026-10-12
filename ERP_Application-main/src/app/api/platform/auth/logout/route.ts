import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { PLATFORM_COOKIE } from "@/lib/platform/session";

export async function POST() {
  const token = cookies().get(PLATFORM_COOKIE)?.value;
  if (token) await prisma.platformSession.updateMany({ where: { token }, data: { revokedAt: new Date() } }).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLATFORM_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
