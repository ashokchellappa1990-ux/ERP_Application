import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = /\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|csv|txt)$/i;

// POST /api/uploads — multipart file upload. Saves under /public/uploads and
// returns a public URL + metadata (used for invoice document attachments).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ ok: false, message: "Invalid upload." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "No file provided." }, { status: 422 });
  if (!ALLOWED.test(file.name)) return NextResponse.json({ ok: false, message: "Unsupported file type." }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, message: "File exceeds 8 MB." }, { status: 422 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const stored = `${randomUUID()}-${safeName}`;
  const dir = path.join(process.cwd(), "public", "uploads", "invoices", String(user.tenantId));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), buffer);

  const url = `/uploads/invoices/${user.tenantId}/${stored}`;
  return NextResponse.json({ ok: true, file: { fileName: file.name, fileUrl: url, fileType: file.type || null, size: file.size } }, { status: 201 });
}
