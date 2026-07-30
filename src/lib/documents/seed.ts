import { registerModule } from "@/lib/ai/moduleRegistry";
import type { ActiveScope } from "@/lib/auth/scope";
import { ensureDefaultCategories } from "./categories";

/**
 * Seed the Document Intelligence platform for a tenant: default categories + register the
 * "knowledge" module with the AI engine so the Copilot/BI/Command Center treat documents
 * as a first-class knowledge source (Module 17 integration).
 */

let registered = false;
export async function registerKnowledgeModule() {
  if (registered) return;
  registered = true;
  await registerModule(null, {
    moduleKey: "knowledge",
    name: "Knowledge & Documents",
    description: "Uploaded enterprise documents — contracts, SOPs, policies, GST notices, manuals, agreements — with AI search, chat, summary and OCR.",
    menu: "/ai/knowledge",
    businessTerms: ["document", "policy", "contract", "agreement", "sop", "manual", "clause", "warranty", "leave policy", "amc", "notice", "circular", "guideline"],
    kpis: ["Total Documents", "Knowledge Coverage", "OCR Completed"],
    questions: ["What is the leave policy?", "Find the supplier agreement", "What is the warranty period?", "Summarise this contract", "Show the cancellation clause"],
    actions: ["Upload Document", "Search Documents", "Chat with Document", "Summarise", "Compare", "Generate FAQ"],
    permissions: ["ai.knowledge"],
    tables: ["Document", "KnowledgeBase", "DocFaq"],
    relationships: ["Customer", "Supplier", "Employee"],
    enabled: true,
  }).catch(() => {});
}

/** Idempotent per-tenant bootstrap — called lazily on first Document Library load. */
export async function ensureKnowledgeSeed(scope: ActiveScope) {
  await registerKnowledgeModule();
  await ensureDefaultCategories(scope).catch(() => {});
}
