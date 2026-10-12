import { z } from "zod";
import { DOC_STATUSES } from "./types";

/** Zod request contracts for the Document Intelligence APIs (shared-contracts pattern). */

export const createDocMetaSchema = z.object({
  title: z.string().max(240).optional(),
  description: z.string().max(600).optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  folderId: z.coerce.number().int().positive().nullable().optional(),
  department: z.string().max(80).nullable().optional(),
  language: z.string().max(12).optional(),
  tags: z.array(z.string().max(40)).optional(),
  linkedModule: z.string().max(40).nullable().optional(),
  linkedType: z.string().max(40).nullable().optional(),
  linkedId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateDocSchema = z.object({
  title: z.string().max(240).optional(),
  description: z.string().max(600).optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  folderId: z.coerce.number().int().positive().nullable().optional(),
  department: z.string().max(80).nullable().optional(),
  language: z.string().max(12).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

export const transitionSchema = z.object({ to: z.enum(DOC_STATUSES) });
export const chatSchema = z.object({ question: z.string().min(2).max(2000) });
export const summarySchema = z.object({ kind: z.string().max(30).optional() });
export const faqSchema = z.object({ count: z.coerce.number().int().min(1).max(50).optional(), promote: z.boolean().optional(), categoryId: z.coerce.number().int().positive().nullable().optional() });
export const translateSchema = z.object({ lang: z.string().min(2).max(12) });
export const compareSchema = z.object({ leftId: z.coerce.number().int().positive(), rightId: z.coerce.number().int().positive() });
export const rollbackSchema = z.object({ versionNo: z.coerce.number().int().positive() });

export const categorySchema = z.object({ name: z.string().min(1).max(120), parentId: z.coerce.number().int().positive().nullable().optional(), description: z.string().max(300).optional(), color: z.string().max(20).optional(), icon: z.string().max(40).optional(), sortOrder: z.coerce.number().int().optional() });
export const knowledgeSchema = z.object({ question: z.string().min(2).max(500), answer: z.string().min(1), categoryId: z.coerce.number().int().positive().nullable().optional(), department: z.string().max(80).optional(), source: z.string().max(16).optional(), documentId: z.coerce.number().int().positive().nullable().optional(), tags: z.array(z.string().max(40)).optional(), status: z.string().max(12).optional() });
export const settingsSchema = z.object({ maxFileSizeMb: z.coerce.number().int().min(1).max(200).optional(), allowedTypes: z.array(z.string()).optional(), langs: z.array(z.string()).optional(), ocrEnabled: z.boolean().optional(), autoIndex: z.boolean().optional(), autoSummary: z.boolean().optional(), embeddingEnabled: z.boolean().optional(), defaultCategoryId: z.coerce.number().int().positive().nullable().optional(), retentionDays: z.coerce.number().int().nullable().optional() });

export type CreateDocMeta = z.infer<typeof createDocMetaSchema>;
export type UpdateDoc = z.infer<typeof updateDocSchema>;
