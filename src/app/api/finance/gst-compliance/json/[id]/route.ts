import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import * as store from "@/lib/finance/gst/store";

const PERM = "finance.gst-compliance";

// GET /api/finance/gst-compliance/json/[id] — download a generated GST JSON file.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const file = await store.getJsonPayload(scope, user, Number(params.id));
  if (!file) return NextResponse.json({ ok: false, message: "Export not found." }, { status: 404 });

  return new NextResponse(file.payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
    },
  });
}
