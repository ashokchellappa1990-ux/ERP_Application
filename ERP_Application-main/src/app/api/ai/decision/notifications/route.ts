import { guardDecision, bad, ok } from "../_util";
import { listNotifications, unreadCount, setNotificationStatus } from "@/lib/ai/decision/notify";
import { notifySchema } from "@/lib/ai/decision/contracts";

/** GET /api/ai/decision/notifications — in-app decision notifications. */
export async function GET(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  return ok({ notifications: await listNotifications(g.scope), unread: await unreadCount(g.scope) });
}

/** POST /api/ai/decision/notifications — mark read/dismissed (id or "all"). */
export async function POST(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const p = notifySchema.safeParse(body);
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid input.");
  const done = await setNotificationStatus(g.scope, p.data.id, p.data.status);
  return done ? ok({ message: "Updated." }) : bad("Not found.", 404);
}
