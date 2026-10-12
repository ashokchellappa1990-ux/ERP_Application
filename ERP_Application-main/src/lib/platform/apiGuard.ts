import { NextResponse } from "next/server";
import { getPlatformUser, platformCan, type PlatformUser } from "@/lib/platform/session";

/** Resolve the platform user + enforce a section permission. Returns the user or a Response. */
export async function platformAuth(section: string): Promise<{ user: PlatformUser } | NextResponse> {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in to the platform portal." }, { status: 401 });
  if (!platformCan(user, section)) return NextResponse.json({ ok: false, message: "You don't have permission for this section." }, { status: 403 });
  return { user };
}
export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;
