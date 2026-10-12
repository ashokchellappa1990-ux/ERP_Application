import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";

const DIR = path.join(process.cwd(), "public", "uploads", "website");
const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);
const MAX = 6 * 1024 * 1024; // 6 MB

/** Upload an image from the Product Admin portal → saved under /public/uploads/website. */
export async function POST(req: Request) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ ok: false, message: "Invalid upload." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "No file provided." }, { status: 422 });
  if (file.size > MAX) return NextResponse.json({ ok: false, message: "File too large (max 6 MB)." }, { status: 422 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) return NextResponse.json({ ok: false, message: "Unsupported type. Use PNG, JPG, WEBP, GIF, SVG or AVIF." }, { status: 422 });

  const base = path.basename(file.name, ext).replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "image";
  const name = `${Date.now()}-${base}${ext}`;
  await fs.mkdir(DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(DIR, name), buffer);

  return NextResponse.json({ ok: true, url: `/uploads/website/${name}`, name }, { status: 201 });
}
