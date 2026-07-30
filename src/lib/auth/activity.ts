import { prisma } from "@/lib/db/prisma";

export type ActivityAction = "login" | "logout" | "login_failed" | "register";
export type ActivityStatus = "success" | "failure";

export interface ActivityEntry {
  userId?: number | null;
  email?: string | null;
  action: ActivityAction;
  status: ActivityStatus;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Write an audit/monitoring log row. Never throws — logging must not break flows. */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: entry.userId ?? null,
        email: entry.email ?? null,
        action: entry.action,
        status: entry.status,
        reason: entry.reason ?? null,
        ipAddress: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[activity] failed to write log", err);
  }
}
