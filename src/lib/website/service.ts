/**
 * Website CMS service — reads/writes the single config row (draft + published)
 * and captures public leads. Used by both the public site API (published only)
 * and the Product Admin portal (draft editing + publish + leads).
 */
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_WEBSITE_CONFIG, mergeConfig, type WebsiteConfig } from "@/lib/website/config";

async function row() {
  return (await prisma.websiteSetting.findFirst()) ?? (await prisma.websiteSetting.create({ data: {} }));
}

function parse(json: string | null | undefined): Partial<WebsiteConfig> | null {
  if (!json) return null;
  try { return JSON.parse(json) as Partial<WebsiteConfig>; } catch { return null; }
}

/** Published config the public site renders (falls back to defaults). Never
 *  throws — the public marketing site (root layout + page, no error boundary
 *  of their own) must still render on a transient DB hiccup instead of
 *  crashing the whole route with an opaque "Server Components render" error. */
export async function getPublishedConfig(): Promise<WebsiteConfig> {
  try {
    const r = await prisma.websiteSetting.findFirst();
    return mergeConfig(parse(r?.publishedJson));
  } catch (err) {
    console.error("[website] getPublishedConfig failed, using defaults", err);
    return mergeConfig(null);
  }
}

/** Draft config for the CMS editor (falls back to published, then defaults). */
export async function getDraftConfig(): Promise<{ config: WebsiteConfig; hasDraft: boolean; publishedAt: string | null }> {
  const r = await row();
  const draft = parse(r.draftJson);
  const config = mergeConfig(draft ?? parse(r.publishedJson));
  return { config, hasDraft: !!draft, publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null };
}

export async function saveDraft(config: WebsiteConfig): Promise<void> {
  const r = await row();
  await prisma.websiteSetting.update({ where: { id: r.id }, data: { draftJson: JSON.stringify(config) } });
}

/** Publish: copy the given config to the published snapshot (and keep as draft). */
export async function publish(config: WebsiteConfig): Promise<string> {
  const r = await row();
  const json = JSON.stringify(config);
  const now = new Date();
  await prisma.websiteSetting.update({ where: { id: r.id }, data: { draftJson: json, publishedJson: json, publishedAt: now } });
  return now.toISOString();
}

/** Reset the draft back to the factory defaults (does not publish). */
export async function resetDraft(): Promise<WebsiteConfig> {
  const r = await row();
  await prisma.websiteSetting.update({ where: { id: r.id }, data: { draftJson: JSON.stringify(DEFAULT_WEBSITE_CONFIG) } });
  return DEFAULT_WEBSITE_CONFIG;
}

/* ------------------------------------------------------------------ leads -- */

export interface LeadInput { type: string; name: string; email: string; phone?: string; company?: string; industry?: string; plan?: string; message?: string; source?: string }

export async function createLead(input: LeadInput): Promise<number> {
  const type = ["trial", "demo", "contact", "subscribe"].includes(input.type) ? input.type : "contact";
  const lead = await prisma.websiteLead.create({
    data: {
      type, name: input.name.slice(0, 200), email: input.email.slice(0, 200),
      phone: input.phone?.slice(0, 40) || null, company: input.company?.slice(0, 200) || null,
      industry: input.industry?.slice(0, 80) || null, plan: input.plan?.slice(0, 40) || null,
      message: input.message?.slice(0, 4000) || null, source: input.source?.slice(0, 120) || "website",
    },
  });
  return lead.id;
}

export async function listLeads(opts: { type?: string; status?: string } = {}) {
  const rows = await prisma.websiteLead.findMany({
    where: { ...(opts.type ? { type: opts.type } : {}), ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" }, take: 500,
  });
  return rows.map((l) => ({ id: l.id, type: l.type, name: l.name, email: l.email, phone: l.phone ?? "", company: l.company ?? "", industry: l.industry ?? "", plan: l.plan ?? "", message: l.message ?? "", source: l.source ?? "", status: l.status, at: l.createdAt.toISOString() }));
}

export async function setLeadStatus(id: number, status: string): Promise<void> {
  const allowed = ["New", "Contacted", "Qualified", "Converted", "Closed"];
  if (!allowed.includes(status)) throw new Error("Invalid status");
  await prisma.websiteLead.update({ where: { id }, data: { status } });
}
