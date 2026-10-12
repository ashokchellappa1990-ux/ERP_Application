import { NextResponse } from "next/server";
import { getPublishedConfig } from "@/lib/website/service";

/** Public — the published website config the marketing site renders. */
export async function GET() {
  try {
    const config = await getPublishedConfig();
    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json({ ok: false, message: "Failed to load website config." }, { status: 500 });
  }
}
