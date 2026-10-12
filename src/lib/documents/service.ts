import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import type { AiActor } from "@/lib/ai/types";
import { indexDocument, chunkText } from "./indexer";
import type { ExtractResult } from "./types";
import { DOC_TRANSITIONS, type DocStatus } from "./types";

/**
 * DOCUMENT SERVICE — create/list/get/update/version/lifecycle for documents. Centralises
 * scope stamping, audit, docNo generation, indexing + chunking. Never posts to any ledger.
 */

const actorRef = (a: AiActor) => ({ id: a.id, tenantId: a.tenantId, fullName: a.fullName ?? null });

export async function nextDocNo(tenantId: number): Promise<string> {
  const n = await prisma.document.count({ where: { tenantId } });
  return `DOC-${String(n + 1).padStart(6, "0")}`;
}

export interface FileMeta { fileName: string; fileUrl: string; fileType: string | null; fileExt: string; fileSize: number; checksum?: string | null }
export interface CreateDocInput {
  title?: string; description?: string; categoryId?: number | null; folderId?: number | null;
  department?: string | null; language?: string; tags?: string[];
  linkedModule?: string | null; linkedType?: string | null; linkedId?: number | null;
}

export async function createDocument(scope: ActiveScope, actor: AiActor, file: FileMeta, extract: ExtractResult, input: CreateDocInput) {
  const idx = indexDocument(extract.text, file.fileName);
  const docNo = await nextDocNo(scope.tenantId);
  const title = (input.title || idx.title).slice(0, 240);
  const doc = await prisma.document.create({
    data: {
      tenantId: scope.tenantId, ...scopeData(scope, { branch: true }),
      docNo, title, description: input.description ?? idx.summary,
      categoryId: input.categoryId ?? null, folderId: input.folderId ?? null,
      ownerId: actor.id, ownerName: actor.fullName ?? null, department: input.department ?? null,
      status: "Draft", language: input.language ?? "en", tagsJson: JSON.stringify(input.tags ?? []),
      fileName: file.fileName, fileUrl: file.fileUrl, fileType: file.fileType, fileExt: file.fileExt, fileSize: file.fileSize, checksum: file.checksum ?? null,
      extractedText: extract.text || null, keywordsJson: JSON.stringify(idx.keywords), entitiesJson: JSON.stringify(idx.entities),
      ocrStatus: extract.needsOcr ? "pending" : "none",
      linkedModule: input.linkedModule ?? null, linkedType: input.linkedType ?? null, linkedId: input.linkedId ?? null,
      currentVersion: 1, createdBy: actor.id, createdByName: actor.fullName ?? null,
    },
  });
  // Version 1 + chunks.
  await prisma.docVersion.create({ data: { tenantId: scope.tenantId, documentId: doc.id, versionNo: 1, fileName: file.fileName, fileUrl: file.fileUrl, fileType: file.fileType, fileSize: file.fileSize, extractedText: extract.text || null, author: actor.fullName ?? null, authorId: actor.id, reason: "Initial upload", isCurrent: true, createdBy: actor.id } });
  await saveChunks(scope.tenantId, doc.id, extract.text);
  await writeAudit(prisma, actorRef(actor), { action: "document.upload", entity: "Document", entityId: doc.id, summary: `Uploaded "${title}" (${docNo})`, meta: { engine: extract.engine, size: file.fileSize, needsOcr: extract.needsOcr }, businessId: scope.businessId, branchId: scope.branchId });
  return doc;
}

export async function saveChunks(tenantId: number, documentId: number, text: string) {
  await prisma.docChunk.deleteMany({ where: { tenantId, documentId } }).catch(() => {});
  const chunks = chunkText(text);
  if (chunks.length) await prisma.docChunk.createMany({ data: chunks.map((c) => ({ tenantId, documentId, chunkNo: c.chunkNo, text: c.text, tokens: c.tokens })) });
}

export interface ListFilters { q?: string; categoryId?: number; folderId?: number; status?: string; tag?: string; ocr?: string; take?: number; skip?: number }
export async function listDocuments(scope: ActiveScope, f: ListFilters) {
  const where = scopeWhere(scope, { branch: true }) as Prisma.DocumentWhereInput;
  where.status = f.status ? f.status : { not: "Deleted" };
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.folderId) where.folderId = f.folderId;
  if (f.ocr) where.ocrStatus = f.ocr;
  if (f.q) where.OR = [{ title: { contains: f.q } }, { docNo: { contains: f.q } }, { description: { contains: f.q } }, { keywordsJson: { contains: f.q.toLowerCase() } }];
  const rows = await prisma.document.findMany({
    where,
    select: { id: true, docNo: true, title: true, description: true, categoryId: true, folderId: true, status: true, language: true, tagsJson: true, fileName: true, fileType: true, fileExt: true, fileSize: true, ocrStatus: true, viewCount: true, downloadCount: true, ownerName: true, department: true, currentVersion: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" }, take: f.take ?? 50, skip: f.skip ?? 0,
  });
  const total = await prisma.document.count({ where });
  return { rows: rows.map((r) => ({ ...r, tags: safe(r.tagsJson) })), total };
}

const safe = (s: string | null): string[] => { if (!s) return []; try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };

export async function getDocument(scope: ActiveScope, id: number, opts?: { incView?: boolean; actor?: AiActor }) {
  const doc = await prisma.document.findFirst({ where: { tenantId: scope.tenantId, id } });
  if (!doc) return null;
  if (opts?.incView) {
    await prisma.document.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    if (opts.actor) await writeAudit(prisma, actorRef(opts.actor), { action: "document.view", entity: "Document", entityId: id, summary: `Viewed "${doc.title}"`, businessId: scope.businessId, branchId: scope.branchId });
  }
  return doc;
}

export async function updateDocument(scope: ActiveScope, actor: AiActor, id: number, patch: Partial<{ title: string; description: string; categoryId: number | null; folderId: number | null; department: string | null; language: string; tags: string[] }>) {
  const doc = await prisma.document.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true, title: true } });
  if (!doc) return null;
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 240);
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
  if (patch.folderId !== undefined) data.folderId = patch.folderId;
  if (patch.department !== undefined) data.department = patch.department;
  if (patch.language !== undefined) data.language = patch.language;
  if (patch.tags !== undefined) data.tagsJson = JSON.stringify(patch.tags);
  const updated = await prisma.document.update({ where: { id }, data });
  await writeAudit(prisma, actorRef(actor), { action: "document.update", entity: "Document", entityId: id, summary: `Updated "${updated.title}"`, meta: patch, businessId: scope.businessId, branchId: scope.branchId });
  return updated;
}

export async function transitionStatus(scope: ActiveScope, actor: AiActor, id: number, to: DocStatus): Promise<{ ok: boolean; message?: string; doc?: unknown }> {
  const doc = await prisma.document.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true, title: true, status: true } });
  if (!doc) return { ok: false, message: "Document not found." };
  const from = doc.status as DocStatus;
  if (!DOC_TRANSITIONS[from]?.includes(to)) return { ok: false, message: `Cannot move from ${from} to ${to}.` };
  const data: Record<string, unknown> = { status: to };
  if (to === "Approved") { data.approvedById = actor.id; data.approvedByName = actor.fullName ?? null; data.approvedAt = new Date(); }
  if (to === "Published") data.publishedAt = new Date();
  const updated = await prisma.document.update({ where: { id }, data });
  await writeAudit(prisma, actorRef(actor), { action: `document.${to.toLowerCase()}`, entity: "Document", entityId: id, summary: `"${doc.title}" ${from} → ${to}`, businessId: scope.businessId, branchId: scope.branchId });
  return { ok: true, doc: updated };
}

export async function softDeleteDocument(scope: ActiveScope, actor: AiActor, id: number) {
  const doc = await prisma.document.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true, title: true } });
  if (!doc) return false;
  await prisma.document.update({ where: { id }, data: { status: "Deleted" } });
  await writeAudit(prisma, actorRef(actor), { action: "document.delete", entity: "Document", entityId: id, summary: `Deleted "${doc.title}"`, businessId: scope.businessId, branchId: scope.branchId });
  return true;
}

export async function incDownload(scope: ActiveScope, actor: AiActor | null, id: number) {
  await prisma.document.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});
  if (actor) await writeAudit(prisma, actorRef(actor), { action: "document.download", entity: "Document", entityId: id, summary: `Downloaded document #${id}`, businessId: scope.businessId, branchId: scope.branchId });
}

// -------------------------------------------------------------- VERSIONS (M12)
export async function listVersions(scope: ActiveScope, documentId: number) {
  return prisma.docVersion.findMany({ where: { tenantId: scope.tenantId, documentId }, orderBy: { versionNo: "desc" } });
}

export async function addVersion(scope: ActiveScope, actor: AiActor, documentId: number, file: FileMeta, extract: ExtractResult, reason: string) {
  const doc = await prisma.document.findFirst({ where: { tenantId: scope.tenantId, id: documentId }, select: { id: true, currentVersion: true, title: true } });
  if (!doc) return null;
  const versionNo = doc.currentVersion + 1;
  await prisma.docVersion.updateMany({ where: { tenantId: scope.tenantId, documentId }, data: { isCurrent: false } });
  const v = await prisma.docVersion.create({ data: { tenantId: scope.tenantId, documentId, versionNo, fileName: file.fileName, fileUrl: file.fileUrl, fileType: file.fileType, fileSize: file.fileSize, extractedText: extract.text || null, author: actor.fullName ?? null, authorId: actor.id, reason, isCurrent: true, createdBy: actor.id } });
  const idx = indexDocument(extract.text, file.fileName);
  await prisma.document.update({ where: { id: documentId }, data: { currentVersion: versionNo, fileName: file.fileName, fileUrl: file.fileUrl, fileType: file.fileType, fileExt: file.fileExt, fileSize: file.fileSize, extractedText: extract.text || null, keywordsJson: JSON.stringify(idx.keywords), entitiesJson: JSON.stringify(idx.entities), status: "Draft" } });
  await saveChunks(scope.tenantId, documentId, extract.text);
  await writeAudit(prisma, actorRef(actor), { action: "document.version", entity: "Document", entityId: documentId, summary: `"${doc.title}" v${versionNo}: ${reason}`, businessId: scope.businessId, branchId: scope.branchId });
  return v;
}

export async function rollbackVersion(scope: ActiveScope, actor: AiActor, documentId: number, versionNo: number) {
  const v = await prisma.docVersion.findFirst({ where: { tenantId: scope.tenantId, documentId, versionNo } });
  if (!v) return { ok: false, message: "Version not found." };
  await prisma.docVersion.updateMany({ where: { tenantId: scope.tenantId, documentId }, data: { isCurrent: false } });
  await prisma.docVersion.update({ where: { id: v.id }, data: { isCurrent: true } });
  const idx = indexDocument(v.extractedText ?? "", v.fileName);
  await prisma.document.update({ where: { id: documentId }, data: { currentVersion: v.versionNo, fileName: v.fileName, fileUrl: v.fileUrl, fileType: v.fileType, fileSize: v.fileSize, extractedText: v.extractedText, keywordsJson: JSON.stringify(idx.keywords), entitiesJson: JSON.stringify(idx.entities) } });
  await saveChunks(scope.tenantId, documentId, v.extractedText ?? "");
  await writeAudit(prisma, actorRef(actor), { action: "document.rollback", entity: "Document", entityId: documentId, summary: `Rolled back to v${versionNo}`, businessId: scope.businessId, branchId: scope.branchId });
  return { ok: true };
}
