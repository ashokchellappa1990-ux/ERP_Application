import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { mergeDispatchConfig } from "@/lib/settings/dispatchConfig";
import { buildGateEntryNo, type TransportConfigData } from "@/lib/settings/transportConfigDefaults";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry/next-number — best-effort preview of the
// number that will be assigned on save (the real one is only known after
// insert — see the POST handler's `${prefix}-${id}` — this is MAX(id)+1, so it
// can drift under concurrent creates or after deletions; harmless since it's
// display-only, and the user can still edit the field before saving).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sc = await settingScope(user);
  const row = await resolveScoped((where) => prisma.dispatchConfiguration.findFirst({ where }), sc);
  const cfg = mergeDispatchConfig(row?.config as unknown as TransportConfigData | undefined);

  // `id` is a single global auto-increment (not per-tenant), so the preview
  // must look at the true global max, not just this tenant's rows.
  const last = await prisma.vehicleGateEntry.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  const nextNo = buildGateEntryNo(cfg, (last?.id ?? 0) + 1);
  return NextResponse.json({ ok: true, nextNo });
}
