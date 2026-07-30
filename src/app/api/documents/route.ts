import { guardDoc, ok } from "./_util";
import { listDocuments } from "@/lib/documents/service";
import { ensureKnowledgeSeed } from "@/lib/documents/seed";

/** GET /api/documents — list documents with filters (q, categoryId, folderId, status, tag, ocr). */
export async function GET(req: Request) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const { scope } = g;
  await ensureKnowledgeSeed(scope).catch(() => {});
  const u = new URL(req.url);
  const n = (k: string) => (u.searchParams.get(k) ? Number(u.searchParams.get(k)) : undefined);
  const s = (k: string) => u.searchParams.get(k) || undefined;
  const { rows, total } = await listDocuments(scope, {
    q: s("q"), categoryId: n("categoryId"), folderId: n("folderId"), status: s("status"), ocr: s("ocr"),
    take: n("take") ?? 60, skip: n("skip") ?? 0,
  });
  return ok({ documents: rows, total });
}
