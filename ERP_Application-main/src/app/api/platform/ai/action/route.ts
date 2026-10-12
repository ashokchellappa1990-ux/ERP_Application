import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";
import { saveAiSettings, setApiKey, apiKeySource } from "@/lib/ai/config";
import { pingClaude } from "@/lib/ai/claudeClient";
import { registerModule } from "@/lib/ai/moduleRegistry";
import { seedAiFoundation } from "@/lib/ai/seed";

// POST /api/platform/ai/action — global AI configuration writes (platform staff only).
export async function POST(req: Request) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  let b: { action?: string } & Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const n = (v: unknown) => Number(v);
  const jsonArr = (v: unknown) => (typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : []);

  try {
    switch (b.action) {
      case "saveSettings":
        await saveAiSettings(null, {
          enabled: b.enabled as boolean, model: b.model as string, maxTokens: n(b.maxTokens), temperature: n(b.temperature),
          streaming: b.streaming as boolean, systemPrompt: (b.systemPrompt as string) || null, dailyTokenLimit: b.dailyTokenLimit ? n(b.dailyTokenLimit) : null,
          retentionDays: b.retentionDays ? n(b.retentionDays) : null, timeoutMs: n(b.timeoutMs) || 30000, maxRetries: n(b.maxRetries) || 2,
        });
        return NextResponse.json({ ok: true, message: "AI settings saved." });
      case "toggleModule":
        await prisma.aiModuleRegistry.updateMany({ where: { tenantId: null, moduleKey: String(b.moduleKey) }, data: { enabled: !!b.enabled } });
        return NextResponse.json({ ok: true, message: "Module updated." });
      case "upsertModule":
        await registerModule(null, { moduleKey: String(b.moduleKey), name: String(b.name), description: (b.description as string) || null, menu: (b.menu as string) || null, businessTerms: jsonArr(b.businessTerms), kpis: jsonArr(b.kpis), questions: jsonArr(b.questions), permissions: jsonArr(b.permissions), enabled: b.enabled !== false });
        return NextResponse.json({ ok: true, message: "Module saved." });
      case "upsertTerm": {
        const data = { term: String(b.term), normalized: String(b.term).toLowerCase(), entity: String(b.entity), kpi: (b.kpi as string) || null, moduleKey: (b.moduleKey as string) || null, definition: (b.definition as string) || null, synonyms: JSON.stringify(jsonArr(b.synonyms)) };
        if (b.id) await prisma.aiSemanticDictionary.update({ where: { id: n(b.id) }, data });
        else await prisma.aiSemanticDictionary.create({ data: { tenantId: null, ...data } });
        return NextResponse.json({ ok: true, message: "Term saved." });
      }
      case "deleteTerm":
        await prisma.aiSemanticDictionary.deleteMany({ where: { id: n(b.id), tenantId: null } });
        return NextResponse.json({ ok: true, message: "Term deleted." });
      case "upsertPrompt": {
        const data = { category: String(b.category), title: String(b.title), promptText: String(b.promptText), description: (b.description as string) || null, isSystem: true, shared: true };
        if (b.id) await prisma.aiPromptLibrary.update({ where: { id: n(b.id) }, data });
        else await prisma.aiPromptLibrary.create({ data: { tenantId: null, ...data } });
        return NextResponse.json({ ok: true, message: "Prompt saved." });
      }
      case "deletePrompt":
        await prisma.aiPromptLibrary.deleteMany({ where: { id: n(b.id), tenantId: null } });
        return NextResponse.json({ ok: true, message: "Prompt deleted." });
      case "saveApiKey": {
        if (apiKeySource && (await apiKeySource()) === "env") return NextResponse.json({ ok: false, message: "An ANTHROPIC_API_KEY environment variable is already set and takes precedence — remove it to use a stored key." }, { status: 422 });
        await setApiKey((b.apiKey as string) || null);
        return NextResponse.json({ ok: true, message: (b.apiKey as string)?.trim() ? "API key saved. Live AI answers are now enabled." : "API key cleared." });
      }
      case "testConnection": {
        const r = await pingClaude();
        return NextResponse.json({ ok: r.ok, message: r.ok ? `Connected to Claude (${r.latencyMs}ms).` : `Could not connect: ${r.detail}` });
      }
      case "reseed": {
        const r = await seedAiFoundation();
        return NextResponse.json({ ok: true, message: `Re-seeded: ${r.modules} modules, ${r.semantic} terms, ${r.prompts} prompts.` });
      }
      default: return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    console.error("[platform/ai/action]", b.action, err);
    return NextResponse.json({ ok: false, message: "Action failed." }, { status: 500 });
  }
}
