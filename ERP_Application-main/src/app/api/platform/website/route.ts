import { NextResponse } from "next/server";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";
import { getDraftConfig, saveDraft, publish, resetDraft } from "@/lib/website/service";
import { mergeConfig, type WebsiteConfig } from "@/lib/website/config";

/** GET — draft config for the CMS editor. Gated to the platform "settings" section. */
export async function GET() {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  const data = await getDraftConfig();
  return NextResponse.json({ ok: true, ...data });
}

/** POST — save draft / publish / reset. */
export async function POST(req: Request) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  let body: { action?: string; config?: Partial<WebsiteConfig> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }

  try {
    if (body.action === "reset") { const config = await resetDraft(); return NextResponse.json({ ok: true, message: "Reset to defaults.", config }); }
    const config = mergeConfig(body.config);
    if (body.action === "publish") { const at = await publish(config); return NextResponse.json({ ok: true, message: "Website published — it's now live.", publishedAt: at }); }
    await saveDraft(config);
    return NextResponse.json({ ok: true, message: "Draft saved." });
  } catch {
    return NextResponse.json({ ok: false, message: "Save failed." }, { status: 500 });
  }
}
