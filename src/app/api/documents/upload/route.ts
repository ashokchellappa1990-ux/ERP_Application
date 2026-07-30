import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID, createHash } from "crypto";
import { guardDoc, bad, ok } from "../_util";
import { extractText, extOf } from "@/lib/documents/extract";
import { createDocument, addVersion } from "@/lib/documents/service";
import { getDocSettings } from "@/lib/documents/settings";
import { ensureKnowledgeSeed } from "@/lib/documents/seed";

export const runtime = "nodejs";

/** POST /api/documents/upload — multipart. Saves the file, extracts + indexes its text,
 *  and creates a Document (v1) OR a new version when `documentId` is supplied. */
export async function POST(req: Request) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const { actor, scope } = g;
  await ensureKnowledgeSeed(scope).catch(() => {});

  let form: FormData;
  try { form = await req.formData(); } catch { return bad("Invalid upload.", 400); }
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file provided.", 422);

  const settings = await getDocSettings(scope.tenantId);
  const ext = extOf(file.name);
  if (settings.allowedTypes.length && !settings.allowedTypes.includes(ext)) return bad(`Unsupported file type ".${ext}".`, 422);
  if (file.size > settings.maxFileSizeMb * 1024 * 1024) return bad(`File exceeds ${settings.maxFileSizeMb} MB.`, 422);

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-90);
  const stored = `${randomUUID()}-${safeName}`;
  const dir = path.join(process.cwd(), "public", "uploads", "documents", String(scope.tenantId));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), buffer);
  const fileUrl = `/uploads/documents/${scope.tenantId}/${stored}`;
  const checksum = createHash("sha1").update(buffer).digest("hex");

  const extract = await extractText(buffer, file.name, file.type || null);
  const fileMeta = { fileName: file.name, fileUrl, fileType: file.type || null, fileExt: ext, fileSize: file.size, checksum };

  // New version of an existing document?
  const documentId = Number(form.get("documentId") || 0);
  if (documentId) {
    const reason = String(form.get("reason") || "New version");
    const v = await addVersion(scope, actor, documentId, fileMeta, extract, reason);
    if (!v) return bad("Document not found.", 404);
    return ok({ documentId, version: v.versionNo, extract: { engine: extract.engine, chars: extract.text.length, needsOcr: extract.needsOcr } });
  }

  const meta = {
    title: (form.get("title") as string) || undefined,
    description: (form.get("description") as string) || undefined,
    categoryId: form.get("categoryId") ? Number(form.get("categoryId")) : (settings.defaultCategoryId ?? null),
    folderId: form.get("folderId") ? Number(form.get("folderId")) : null,
    department: (form.get("department") as string) || null,
    language: (form.get("language") as string) || "en",
    tags: form.get("tags") ? String(form.get("tags")).split(",").map((t) => t.trim()).filter(Boolean) : [],
    linkedModule: (form.get("linkedModule") as string) || null,
    linkedType: (form.get("linkedType") as string) || null,
    linkedId: form.get("linkedId") ? Number(form.get("linkedId")) : null,
  };
  const doc = await createDocument(scope, actor, fileMeta, extract, meta);
  return ok({ document: { id: doc.id, docNo: doc.docNo, title: doc.title, status: doc.status }, extract: { engine: extract.engine, chars: extract.text.length, needsOcr: extract.needsOcr, note: extract.note } });
}
