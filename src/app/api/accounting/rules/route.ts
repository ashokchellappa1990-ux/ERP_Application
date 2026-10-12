import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import type { RuleEngineResponse, RuleEngineSaveResponse } from "@/lib/contracts/accounting";

const PERM = "accounting.rule-engine";

// GET /api/accounting/rules — saved Accounting Rule Engine config (or null → defaults).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const row = await prisma.accountingRuleSetting.findUnique({ where: { tenantId: user.tenantId } });
  return NextResponse.json({ ok: true, config: row?.config ?? null } satisfies RuleEngineResponse);
}

// PUT /api/accounting/rules — save the rule-engine config (RuleGroup[]).
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "AccountingRule" });
  if (denied) return denied;

  let body: { config?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  if (!Array.isArray(body.config)) return NextResponse.json({ ok: false, message: "Invalid rule config." }, { status: 422 });

  const config = body.config as unknown as Prisma.InputJsonValue;
  const row = await prisma.accountingRuleSetting.upsert({
    where: { tenantId: user.tenantId },
    create: { tenantId: user.tenantId, config },
    update: { config },
  });
  await writeAudit(prisma, user, {
    action: "accounting_rule.save", entity: "AccountingRule", entityId: row.tenantId,
    summary: `Saved accounting rule engine (${body.config.length} module groups)`,
    meta: { groups: body.config.length },
    ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Rule engine saved.", config: row.config } satisfies RuleEngineSaveResponse);
}
