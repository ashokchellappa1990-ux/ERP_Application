import { guardDoc, bad, ok } from "../_util";
import { getDocSettings, saveDocSettings } from "@/lib/documents/settings";
import { getAiSettings } from "@/lib/ai/config";
import { SUPPORTED_LANGS, DEFAULT_ALLOWED_EXTS } from "@/lib/documents/types";
import { settingsSchema } from "@/lib/documents/contracts";

/** GET /api/documents/settings — Document Intelligence settings + AI connection status. */
export async function GET(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "DocSettings");
  if ("error" in g) return g.error;
  const [settings, ai] = await Promise.all([getDocSettings(g.scope.tenantId), getAiSettings(g.scope.tenantId)]);
  return ok({ settings, options: { langs: SUPPORTED_LANGS, allTypes: DEFAULT_ALLOWED_EXTS }, ai: { apiKeyPresent: ai.apiKeyPresent, model: ai.model, enabled: ai.enabled } });
}

/** PUT /api/documents/settings — update settings. */
export async function PUT(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "DocSettings");
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  await saveDocSettings(g.scope.tenantId, g.actor.id, parsed.data);
  const settings = await getDocSettings(g.scope.tenantId);
  return ok({ settings });
}
