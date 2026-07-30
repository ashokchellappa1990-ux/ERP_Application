import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { getActiveTerminalContext, type TerminalCtx } from "@/lib/pos/terminalContext";
import { getUserTerminalIds } from "@/lib/pos/userTerminals";
import type { TerminalBilling, TerminalConfig } from "@/lib/contracts/posTerminal";

/**
 * Terminal-based operation guard (gated by General Settings `terminalSetupRequired`).
 *
 * When the flag is ON: transactions must be created at a registered terminal under
 * an open session, the terminal's billing flags decide which transaction types it
 * may do, and list queries are scoped to the user's mapped terminals. When OFF,
 * everything behaves exactly as before (no enforcement, no filtering).
 */

type ScopeUser = Parameters<typeof getActiveTerminalContext>[0] & { id: number };

/** Is terminal-based setup required for this user's active scope? */
export async function isTerminalSetupRequired(user: { tenantId: number; businessId?: number | null; branchId?: number | null }): Promise<boolean> {
  const row = await resolveScoped((where) => prisma.generalSetting.findFirst({ where }), await settingScope(user));
  return !!row?.terminalSetupRequired;
}

interface TxnOpts {
  feature?: keyof TerminalBilling; // billing flag the terminal must have enabled (sales family)
  label?: string; // human label for error messages
}

/**
 * Resolve the active terminal context for a transaction create, enforcing the
 * terminal-setup rules when the flag is on. Returns `{ ctx }` to stamp with, or
 * `{ denied }` (a ready 422) to return immediately.
 */
export async function requireTerminalForTxn(user: ScopeUser, opts: TxnOpts = {}): Promise<{ denied?: NextResponse; ctx: TerminalCtx | null }> {
  const ctx = await getActiveTerminalContext(user);
  const required = await isTerminalSetupRequired(user);
  if (!required) return { ctx };

  const label = opts.label ?? "transaction";
  if (!ctx) {
    return { ctx, denied: NextResponse.json({ ok: false, message: `Open a terminal session at a registered terminal before recording this ${label}.`, needsTerminal: true }, { status: 422 }) };
  }
  if (opts.feature) {
    const terminal = await prisma.posTerminal.findFirst({ where: { id: ctx.terminalId, tenantId: user.tenantId }, select: { config: true, code: true } });
    const billing = ((terminal?.config ?? {}) as TerminalConfig).billing ?? {};
    if (billing[opts.feature] !== true) {
      return { ctx, denied: NextResponse.json({ ok: false, message: `Terminal ${terminal?.code ?? ""} is not enabled for ${label}.`, featureDenied: opts.feature }, { status: 422 }) };
    }
  }
  return { ctx };
}

/**
 * Prisma `where` fragment scoping a transaction list to the user's terminals.
 * OFF → {} (no filter). ON → mapped users restricted to their terminals (honouring
 * an in-range `?terminalId` filter); unmapped users see all, or the requested
 * terminal when a `?terminalId` filter is supplied.
 */
export async function terminalListWhere(user: { id: number; tenantId: number; businessId?: number | null; branchId?: number | null }, terminalParam?: string | null): Promise<{ terminalId?: number | { in: number[] } }> {
  if (!(await isTerminalSetupRequired(user))) return {};
  const ids = await getUserTerminalIds(user);
  const param = terminalParam ? Number(terminalParam) : null;
  if (ids.length === 0) return param ? { terminalId: param } : {}; // unmapped → all (or the requested terminal)
  if (param && ids.includes(param)) return { terminalId: param };
  return { terminalId: { in: ids } };
}
