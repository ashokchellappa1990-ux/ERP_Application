/** Shared client types + fetch helpers for the Knowledge & Document Intelligence UI. */

export interface DocRow {
  id: number; docNo: string; title: string; description: string | null; categoryId: number | null; folderId: number | null;
  status: string; language: string; tags: string[]; fileName: string; fileType: string | null; fileExt: string | null; fileSize: number;
  ocrStatus: string; viewCount: number; downloadCount: number; ownerName: string | null; department: string | null; currentVersion: number;
  createdAt: string; updatedAt: string;
}
export interface DocFull extends DocRow {
  extractedText: string | null; entities: Record<string, string[]> | null; keywords: string[]; summary: unknown;
  fileUrl: string;
}
export interface CategoryRow { id: number; name: string; slug: string; color: string | null; icon: string | null; parentId: number | null; count: number; active: boolean }
export interface DocHit { id: number; docNo: string; title: string; status: string; score: number; snippet: string; href: string }

export const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  Draft: "neutral", Review: "warning", Approved: "info", Published: "success", Archived: "neutral", Deleted: "danger",
};

export async function jget<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return r.json();
}
export async function jsend<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

export function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"]; const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${Math.round((n / Math.pow(1024, i)) * 10) / 10} ${u[i]}`;
}
export function fmtDate(s: string): string { try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; } }

export const EXT_ICON: Record<string, string> = { pdf: "📕", doc: "📘", docx: "📘", xls: "📗", xlsx: "📗", csv: "📗", txt: "📄", rtf: "📄", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", tiff: "🖼️", tif: "🖼️", eml: "✉️", zip: "🗜️" };
