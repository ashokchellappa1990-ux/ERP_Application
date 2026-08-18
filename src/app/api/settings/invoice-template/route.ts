import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const STR = ["title", "paperSize", "headerNote", "thankYouMessage", "footerNote", "contactNumber"] as const;
// Not length-truncated like STR above — these are base64 data: URIs, easily
// tens of KB, uploaded via the same FileReader.readAsDataURL pattern as the
// company logo elsewhere in this app.
const IMAGE_FIELDS = ["qrCodeImage", "signatureImage"] as const;
const FLAGS = ["showGstin", "showCustomer", "showHsn", "showMrp", "showSavings", "showTaxBreakup", "showItemTax", "useBranchDetails", "showBranchName", "showContact"] as const;
// B2B_T2 — the alternate "Tax Invoice" design (Bill To/Vehicle/Driver/weight
// line/Royalty Pass) used from Load & Dispatch; B2B_T3 — a further GST-style
// design (Bill To/Ship info/Driver/Vehicle, a per-line Price+Taxable Price+GST
// table, an HSN-wise CGST/SGST summary table, Bank QR + Signature) — this is
// the one actually printed from Load & Dispatch + the Sales Invoice page;
// B2B_T2 stays configurable but nothing prints it by default anymore.
// WEIGHT_SLIP — the weighbridge slip printed alongside the invoice; TOKEN —
// the gate token printed right after a Pre-Loading Weighment (same slip
// shape, but Load/Net Weight aren't known yet). All of these reuse the same
// InvoiceTemplate row shape (just title/headerNote/footerNote/paperSize, plus
// qrCodeImage/signatureImage for B2B_T3, are meaningful for them — the FLAGS
// toggles are B2C/B2B-receipt-specific and unused by these).
const TYPES = ["B2C", "B2B", "B2B_T2", "B2B_T3", "WEIGHT_SLIP", "TOKEN", "COLLECTION"] as const;
type TplType = (typeof TYPES)[number];

// Sensible per-type default title so a freshly-seeded template reads correctly.
const DEFAULT_TITLE: Record<TplType, string> = { B2C: "Tax Invoice", B2B: "Tax Invoice", B2B_T2: "Tax Invoice", B2B_T3: "Tax Invoice", WEIGHT_SLIP: "WEIGHMENT SLIP", TOKEN: "TOKEN", COLLECTION: "Collection Receipt" };

function resolveType(v: unknown): TplType {
  const t = String(v ?? "B2C").toUpperCase();
  return (TYPES as readonly string[]).includes(t) ? (t as TplType) : "B2C";
}

async function getOrCreate(tenantId: number, type: TplType) {
  return (
    (await prisma.invoiceTemplate.findUnique({ where: { tenantId_type: { tenantId, type } } })) ??
    (await prisma.invoiceTemplate.create({ data: { tenantId, type, title: DEFAULT_TITLE[type] } }))
  );
}
function toJson(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { type: row.type };
  for (const k of STR) out[k] = row[k] ?? "";
  for (const k of IMAGE_FIELDS) out[k] = row[k] ?? "";
  for (const k of FLAGS) out[k] = !!row[k];
  out.tokenCodeType = row.tokenCodeType === "barcode" ? "barcode" : "qrcode";
  out.tokenBrandFontSize = ["large", "xlarge"].includes(String(row.tokenBrandFontSize)) ? row.tokenBrandFontSize : "normal";
  out.tokenBoldValues = !!row.tokenBoldValues;
  return out;
}

// GET /api/settings/invoice-template?type=B2C|B2B|COLLECTION
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const type = resolveType(new URL(req.url).searchParams.get("type"));
  const row = await getOrCreate(user.tenantId, type);
  return NextResponse.json({ ok: true, template: toJson(row as Record<string, unknown>) });
}

// PUT /api/settings/invoice-template?type=B2C|B2B|COLLECTION
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.invoice-template", { req, entity: "Setting" });
  if (denied) return denied;

  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const type = resolveType(b.type ?? new URL(req.url).searchParams.get("type"));
  const cur = await getOrCreate(user.tenantId, type);
  const data: Prisma.InvoiceTemplateUncheckedUpdateInput = {};
  for (const k of STR) if (b[k] != null) data[k] = String(b[k]).slice(0, k === "footerNote" ? 300 : k === "contactNumber" ? 40 : 200);
  if (b.paperSize && !["58mm", "80mm", "A5", "A4"].includes(String(b.paperSize))) delete data.paperSize;
  if (b.tokenCodeType != null) data.tokenCodeType = String(b.tokenCodeType) === "barcode" ? "barcode" : "qrcode";
  if (b.tokenBrandFontSize != null) data.tokenBrandFontSize = ["large", "xlarge"].includes(String(b.tokenBrandFontSize)) ? String(b.tokenBrandFontSize) : "normal";
  if (b.tokenBoldValues != null) data.tokenBoldValues = !!b.tokenBoldValues;
  // Cap at 2MB of base64 text (~1.5MB image) — generous for a QR/signature
  // image while keeping a runaway upload from bloating this row indefinitely.
  for (const k of IMAGE_FIELDS) if (b[k] != null) data[k] = String(b[k]).slice(0, 2_000_000);
  for (const k of FLAGS) if (b[k] != null) data[k] = !!b[k];

  const row = await prisma.invoiceTemplate.update({ where: { id: cur.id }, data });
  await writeAudit(prisma, user, {
    action: "settings.invoice-template.save", entity: "Setting", entityId: "invoice-template",
    summary: "Updated Invoice Template settings", meta: { type },
    ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Invoice template saved.", template: toJson(row as Record<string, unknown>) });
}
