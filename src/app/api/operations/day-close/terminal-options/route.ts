import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { isTerminalSetupRequired } from "@/lib/pos/terminalGuard";
import { getUserTerminalIds } from "@/lib/pos/userTerminals";
import type { EodTerminalOptions } from "@/lib/contracts/eod";

// GET /api/operations/day-close/terminal-options — drives the console terminal filter.
//   • terminal setup OFF        → show:false (no filter)
//   • mapped user (assigned)    → only their terminals, default = first, restricted (no "All")
//   • unmapped (admin/manager)  → all active terminals in scope, default = null (All)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "operations.day-close");
  if (denied) return denied;

  if (!(await isTerminalSetupRequired(user))) {
    const off: EodTerminalOptions = { ok: true, show: false, restricted: false, defaultId: null, terminals: [] };
    return NextResponse.json(off);
  }

  const mapped = await getUserTerminalIds(user);
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where = mapped.length
    ? { id: { in: mapped }, tenantId: user.tenantId, status: "active" }
    : { ...sw, status: "active" };
  const rows = await prisma.posTerminal.findMany({ where, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });

  const res: EodTerminalOptions = {
    ok: true,
    show: rows.length > 0,
    restricted: mapped.length > 0,
    defaultId: mapped.length ? rows[0]?.id ?? null : null,
    terminals: rows,
  };
  return NextResponse.json(res);
}
