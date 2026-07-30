import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";

const DIR = path.join(process.cwd(), "public", "uploads", "website");

/** List images already uploaded to the media folder (for the CMS picker). */
export async function GET() {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  try {
    await fs.mkdir(DIR, { recursive: true });
    const files = await fs.readdir(DIR);
    const items = await Promise.all(
      files.filter((f) => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f)).map(async (f) => {
        const st = await fs.stat(path.join(DIR, f));
        return { name: f, url: `/uploads/website/${f}`, at: st.mtimeMs };
      })
    );
    items.sort((a, b) => b.at - a.at);
    return NextResponse.json({ ok: true, rows: items });
  } catch {
    return NextResponse.json({ ok: true, rows: [] });
  }
}

/** Delete an uploaded image. */
export async function DELETE(req: Request) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const safe = path.basename(name);
  if (!safe || safe !== name) return NextResponse.json({ ok: false, message: "Invalid name." }, { status: 422 });
  try { await fs.unlink(path.join(DIR, safe)); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 }); }
}
