import { NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/platform/session";

export async function GET() {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user });
}
