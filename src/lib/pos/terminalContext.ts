import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/**
 * Active POS terminal context (Phase 6 of POS Terminal & Shift Management).
 *
 * When a cashier opens a Terminal Session, the session-open route sets the
 * `pos_terminal_ctx` cookie. Transaction-create routes call
 * `getActiveTerminalContext` to resolve & validate the live session, then
 * `stampTerminal` to get the 6 traceability columns to write onto the row.
 */

export const POS_CTX_COOKIE = "pos_terminal_ctx";

export interface TerminalCtx {
  terminalId: number;
  terminalSessionId: number;
  shiftSessionId: number | null;
  cashierUserId: number;
  dayOpeningId: number | null; // EOD: the open DayOpening for this session, if any
  source: string; // WEB_POS | MOBILE_POS | ...
}

export interface TerminalStamp {
  terminalId?: number;
  terminalSessionId?: number;
  shiftSessionId?: number | null;
  cashierUserId?: number;
  dayOpeningId?: number | null;
  transactionSource: string;
}

/** Serialize the cookie value written at session open. */
export function ctxCookieValue(p: { terminalId: number; sessionId: number; shiftId: number | null }): string {
  return JSON.stringify(p);
}

/** Resolve the cashier's live terminal session from the cookie (validated as Open
 *  and owned by this tenant), or null when no POS session is active. */
export async function getActiveTerminalContext(user: { tenantId: number }): Promise<TerminalCtx | null> {
  const raw = cookies().get(POS_CTX_COOKIE)?.value;
  if (!raw) return null;
  let parsed: { sessionId?: number } = {};
  try { parsed = JSON.parse(raw); } catch { return null; }
  const sessionId = Number(parsed.sessionId);
  if (!sessionId) return null;

  const sess = await prisma.terminalSession.findFirst({
    where: { id: sessionId, tenantId: user.tenantId, status: "Open" },
    select: { id: true, terminalId: true, shiftId: true, cashierUserId: true },
  });
  if (!sess) return null;
  // EOD: the open business day for this session, if Day Opening is in use.
  const day = await prisma.dayOpening.findFirst({
    where: { tenantId: user.tenantId, terminalSessionId: sess.id, status: "Open" },
    select: { id: true },
  });
  return {
    terminalId: sess.terminalId,
    terminalSessionId: sess.id,
    shiftSessionId: sess.id, // this record is both terminal- and shift-session for now
    cashierUserId: sess.cashierUserId,
    dayOpeningId: day?.id ?? null,
    source: "WEB_POS",
  };
}

/** Map a context (or null) to the 6 traceability columns for a transaction insert. */
export function stampTerminal(ctx: TerminalCtx | null, fallbackSource = "API"): TerminalStamp {
  if (!ctx) return { transactionSource: fallbackSource };
  return {
    terminalId: ctx.terminalId,
    terminalSessionId: ctx.terminalSessionId,
    shiftSessionId: ctx.shiftSessionId,
    cashierUserId: ctx.cashierUserId,
    dayOpeningId: ctx.dayOpeningId,
    transactionSource: ctx.source,
  };
}
