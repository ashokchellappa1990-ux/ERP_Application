import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { guardDoc } from "../../_util";
import { getDocument, incDownload } from "@/lib/documents/service";

export const runtime = "nodejs";

/** GET /api/documents/[id]/download — stream the stored file + count the download. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req, "ai.knowledge");
  if ("error" in g) return g.error;
  const id = Number(params.id);
  const doc = await getDocument(g.scope, id);
  if (!doc) return NextResponse.json({ ok: false, message: "Document not found." }, { status: 404 });
  let data: Buffer;
  try { data = await readFile(path.join(process.cwd(), "public", doc.fileUrl.replace(/^\//, ""))); }
  catch { return NextResponse.json({ ok: false, message: "File not found on disk." }, { status: 404 }); }
  await incDownload(g.scope, g.actor, id);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": doc.fileType || "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "content-length": String(data.length),
    },
  });
}
