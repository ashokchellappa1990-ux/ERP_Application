import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { companySetupSchema, validateCompleted, type CompanySetupInput } from "@/lib/validation/companySetupSchema";
import { ensureEntityTypesSeeded, rebuildHierarchy, LEGACY_TYPE_ALIAS } from "@/lib/system/branchHierarchy";

const nn = (s?: unknown) => {
  const t = typeof s === "string" ? s.trim() : "";
  return t ? t : null;
};

/* ---- column ⇄ nested-value maps (no JSON anywhere) ---- */
// [column, weekday]
const DAY_COLS: [string, string][] = [
  ["workMon", "Mon"], ["workTue", "Tue"], ["workWed", "Wed"], ["workThu", "Thu"],
  ["workFri", "Fri"], ["workSat", "Sat"], ["workSun", "Sun"],
];
// [column, toggleGroup, toggleId]
const TOGGLE_COLS: [string, string, string][] = [
  ["orgCentralInventory", "orgCentralized", "inventory"],
  ["orgCentralPricing", "orgCentralized", "pricing"],
  ["taxCgst", "gstTaxes", "cgst"], ["taxSgst", "gstTaxes", "sgst"], ["taxIgst", "gstTaxes", "igst"],
  ["hwThermal", "hardware", "thermal"], ["hwBarcode", "hardware", "barcode"], ["hwQr", "hardware", "qr"],
  ["hwDrawer", "hardware", "drawer"], ["hwDisplay", "hardware", "display"], ["hwScale", "hardware", "scale"], ["hwBiometric", "hardware", "biometric"],
  ["modMasters", "modules", "masters"], ["modPurchase", "modules", "purchase"], ["modInventory", "modules", "inventory"],
  ["modSales", "modules", "sales"], ["modCrm", "modules", "crm"], ["modLoyalty", "modules", "loyalty"], ["modChit", "modules", "chit"],
  ["modAccounting", "modules", "accounting"], ["modGst", "modules", "gst"], ["modEinvoice", "modules", "einvoice"], ["modEway", "modules", "eway"],
  ["modHrms", "modules", "hrms"], ["modReports", "modules", "reports"], ["modAi", "modules", "ai"], ["modPharmacy", "modules", "pharmacy"],
  ["secOtp", "security", "otp"], ["sec2fa", "security", "2fa"], ["secPwExpiry", "security", "pwexpiry"], ["secSession", "security", "session"], ["secAudit", "security", "audit"],
  ["impProducts", "migrationImports", "products"], ["impCustomers", "migrationImports", "customers"], ["impSuppliers", "migrationImports", "suppliers"],
  ["impStock", "migrationImports", "stock"], ["impBalances", "migrationImports", "balances"],
];
// [column, flagKey]
const FLAG_COLS: [string, string][] = [["gstEinvoice", "gstEinvoice"], ["gstEway", "gstEway"]];

// GET /api/company-setup — the owner's saved setup, reshaped for the wizard.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup");
  if (denied) return denied;

  const setup = await prisma.companySetup.findUnique({
    where: { userId: user.id },
    include: { warehouses: true, banks: true, teamUsers: true },
  });
  if (!setup) return NextResponse.json({ ok: true, exists: false, setup: null });

  // Branches live in the real branches table (default business), not on the setup.
  const business = await prisma.business.findFirst({ where: { tenantId: user.tenantId, isDefault: true }, select: { id: true } });
  const branchRows = business
    ? await prisma.branch.findMany({ where: { businessId: business.id }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] })
    : [];
  // Entity-type name (shown in the "Entity Type" dropdown) + parent code, so the
  // wizard reflects the hierarchy set on the dedicated Branch Setup screen.
  const etNameById = new Map((await prisma.entityType.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } })).map((e) => [e.id, e.name]));
  const codeById = new Map(branchRows.map((b) => [b.id, b.code ?? ""]));

  const row = setup as unknown as Record<string, unknown>;
  const toggles: Record<string, Record<string, boolean>> = {};
  for (const [col, group, id] of TOGGLE_COLS) (toggles[group] ??= {})[id] = !!row[col];
  const flags: Record<string, boolean> = {};
  for (const [col, flag] of FLAG_COLS) flags[flag] = !!row[col];
  const workingDays = DAY_COLS.filter(([col]) => row[col]).map(([, day]) => day);

  const data = {
    company: {
      name: setup.companyName ?? "", legalName: setup.legalName ?? "", businessType: setup.businessType ?? "",
      industry: setup.industry ?? "", nature: setup.nature ?? "", established: setup.established ?? "",
      gst: setup.gstNumber ?? "", pan: setup.pan ?? "", cin: setup.cin ?? "", udyam: setup.udyam ?? "",
      fssai: setup.fssai ?? "", drugLicense: setup.drugLicense ?? "", email: setup.companyEmail ?? "",
      phone: setup.companyPhone ?? "", website: setup.website ?? "", logo: setup.logoUrl ?? "", address: setup.addressLine ?? "",
      country: setup.country ?? "India", state: setup.state ?? "", city: setup.city ?? "", pincode: setup.pincode ?? "",
    },
    profile: { employees: setup.employees ?? "", turnover: setup.turnover ?? "", ownership: setup.ownership ?? "", startTime: setup.startTime ?? "", endTime: setup.endTime ?? "" },
    workingDays,
    contacts: {
      primary: { name: setup.primaryName ?? "", mobile: setup.primaryMobile ?? "", email: setup.primaryEmail ?? "", designation: setup.primaryDesignation ?? "" },
      secondary: { name: setup.secondaryName ?? "", mobile: setup.secondaryMobile ?? "", email: setup.secondaryEmail ?? "", designation: setup.secondaryDesignation ?? "" },
    },
    org: { type: setup.orgType ?? "single" },
    finance: { fyStart: setup.fyStart ?? "", fyEnd: setup.fyEnd ?? "", acctStart: setup.acctStart ?? "", currency: setup.currency ?? "INR", method: setup.accountingMethod ?? "accrual", costCenter: setup.costCenter ?? "", profitCenter: setup.profitCenter ?? "" },
    gst: { gstin: setup.gstin ?? "", pan: setup.gstPan ?? "", stateCode: setup.gstStateCode ?? "", effective: setup.gstEffective ?? "", regType: setup.gstRegType ?? "regular", frequency: setup.gstFrequency ?? "monthly" },
    admin: { name: setup.adminName ?? "", mobile: setup.adminMobile ?? "", email: setup.adminEmail ?? "", username: setup.adminUsername ?? "" },
    branches: branchRows.map((b) => ({
      id: `db-${b.id}`, name: b.name ?? "", code: b.code ?? "",
      type: (b.entityTypeId ? etNameById.get(b.entityTypeId) : null) ?? b.type ?? "",
      parentCode: b.parentBranchId ? (codeById.get(b.parentBranchId) ?? "") : "",
      gstin: b.gstin ?? "",
      address: b.address ?? "", state: b.state ?? "", city: b.city ?? "", pincode: b.pincode ?? "",
      openTime: b.openTime ?? "", closeTime: b.closeTime ?? "", manager: b.manager ?? "", contactPerson: b.contactPerson ?? "",
      phone: b.phone ?? "", email: b.email ?? "",
      // Branch-level bank accounts (setup_banks rows scoped to this branch).
      banks: setup.banks.filter((bk) => bk.branchId === b.id).map((bk) => ({ id: `db-${bk.id}`, bankName: bk.bankName ?? "", branch: bk.branch ?? "", account: bk.account ?? "", ifsc: bk.ifsc ?? "", type: bk.type ?? "Current", upi: bk.upi ?? "" })),
    })),
    warehouses: setup.warehouses.map((w) => ({ id: `db-${w.id}`, name: w.name ?? "", code: w.code ?? "", type: w.type ?? "", address: w.address ?? "", contact: w.contact ?? "", mobile: w.mobile ?? "", capacity: w.capacity ?? "", branch: w.branch ?? "" })),
    // Company-level bank accounts only (branchId null); branch banks live on each branch above.
    banks: setup.banks.filter((b) => b.branchId == null).map((b) => ({ id: `db-${b.id}`, bankName: b.bankName ?? "", branch: b.branch ?? "", account: b.account ?? "", ifsc: b.ifsc ?? "", type: b.type ?? "", upi: b.upi ?? "" })),
    users: setup.teamUsers.map((u) => ({ id: `db-${u.id}`, name: u.name ?? "", mobile: u.mobile ?? "", email: u.email ?? "", username: u.username ?? "", role: u.role ?? "" })),
    inventoryValuation: setup.inventoryValuation ?? "fifo",
    paymentDefault: setup.paymentDefault ?? "cash",
    migrationSource: setup.migrationSource ?? "",
    industrySelected: setup.industrySelected ?? "",
    toggles,
    flags,
  };

  return NextResponse.json({ ok: true, exists: true, status: setup.status, mode: setup.mode, currentStep: setup.currentStep, data });
}

// PUT /api/company-setup — create or update the setup (draft or completed).
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup", { req, entity: "CompanySetup" });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const parsed = companySetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid setup payload." }, { status: 422 });
  }
  const d: CompanySetupInput = parsed.data;

  if (d.status === "completed") {
    const { errors, step } = validateCompleted(d);
    if (Object.keys(errors).length) {
      return NextResponse.json({ ok: false, message: "Please complete the required fields.", errors, step }, { status: 422 });
    }
  }

  // Map nested values into individual boolean / string columns.
  const p = d.contacts.primary as Record<string, unknown>;
  const sec = d.contacts.secondary as Record<string, unknown>;
  const adm = d.admin as Record<string, unknown>;
  const cols: Record<string, unknown> = {};
  const days = new Set((d.workingDays ?? []).map(String));
  for (const [col, day] of DAY_COLS) cols[col] = days.has(day);
  for (const [col, group, id] of TOGGLE_COLS) cols[col] = !!(d.toggles as Record<string, Record<string, boolean>>)?.[group]?.[id];
  for (const [col, flag] of FLAG_COLS) cols[col] = !!(d.flags as Record<string, boolean>)?.[flag];
  cols.primaryName = nn(p.name); cols.primaryMobile = nn(p.mobile); cols.primaryEmail = nn(p.email); cols.primaryDesignation = nn(p.designation);
  cols.secondaryName = nn(sec.name); cols.secondaryMobile = nn(sec.mobile); cols.secondaryEmail = nn(sec.email); cols.secondaryDesignation = nn(sec.designation);
  cols.adminName = nn(adm.name); cols.adminMobile = nn(adm.mobile); cols.adminEmail = nn(adm.email); cols.adminUsername = nn(adm.username);

  const parentData = {
    mode: d.mode || "standard",
    status: d.status,
    currentStep: d.currentStep,
    completedAt: d.status === "completed" ? new Date() : null,
    companyName: nn(d.company.name), legalName: nn(d.company.legalName), logoUrl: d.company.logo ? d.company.logo : null, businessType: nn(d.company.businessType),
    industry: nn(d.company.industry), nature: nn(d.company.nature), established: nn(d.company.established),
    companyEmail: nn(d.company.email), companyPhone: nn(d.company.phone), website: nn(d.company.website),
    gstNumber: nn(d.company.gst)?.toUpperCase() ?? null, pan: nn(d.company.pan)?.toUpperCase() ?? null,
    cin: nn(d.company.cin)?.toUpperCase() ?? null, udyam: nn(d.company.udyam), fssai: nn(d.company.fssai),
    drugLicense: nn(d.company.drugLicense), addressLine: nn(d.company.address), country: nn(d.company.country) ?? "India",
    state: nn(d.company.state), city: nn(d.company.city), pincode: nn(d.company.pincode),
    employees: nn(d.profile.employees), turnover: nn(d.profile.turnover), ownership: nn(d.profile.ownership),
    startTime: nn(d.profile.startTime), endTime: nn(d.profile.endTime),
    orgType: nn(d.org.type),
    fyStart: nn(d.finance.fyStart), fyEnd: nn(d.finance.fyEnd), acctStart: nn(d.finance.acctStart),
    currency: nn(d.finance.currency) ?? "INR", accountingMethod: nn(d.finance.method), costCenter: nn(d.finance.costCenter), profitCenter: nn(d.finance.profitCenter),
    gstin: nn(d.gst.gstin)?.toUpperCase() ?? null, gstPan: nn(d.gst.pan)?.toUpperCase() ?? null, gstStateCode: nn(d.gst.stateCode),
    gstEffective: nn(d.gst.effective), gstRegType: nn(d.gst.regType), gstFrequency: nn(d.gst.frequency),
    inventoryValuation: nn(d.inventoryValuation), paymentDefault: nn(d.paymentDefault),
    migrationSource: nn(d.migrationSource), industrySelected: nn(d.industrySelected),
    ...cols,
  };

  const result = await prisma.$transaction(async (tx) => {
    const setup = await tx.companySetup.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tenantId: user.tenantId, ...parentData } as Prisma.CompanySetupUncheckedCreateInput,
      update: parentData as Prisma.CompanySetupUncheckedUpdateInput,
    });
    await Promise.all([
      tx.setupWarehouse.deleteMany({ where: { setupId: setup.id } }),
      tx.setupBank.deleteMany({ where: { setupId: setup.id } }),
      tx.setupUser.deleteMany({ where: { setupId: setup.id } }),
    ]);
    if (d.warehouses.length)
      await tx.setupWarehouse.createMany({ data: d.warehouses.map((w) => ({ setupId: setup.id, name: nn(w.name), code: nn(w.code), type: nn(w.type), address: nn(w.address), contact: nn(w.contact), mobile: nn(w.mobile), capacity: nn(w.capacity), branch: nn(w.branch) })) });
    if (d.users.length)
      await tx.setupUser.createMany({ data: d.users.map((u) => ({ setupId: setup.id, name: nn(u.name), mobile: nn(u.mobile), email: nn(u.email), username: nn(u.username), role: nn(u.role) })) });

    // Business Setup writes to the tenant's (default) Business + its branches.
    // The business exists from registration; create defensively if missing.
    const bizName = nn(d.company.name) || nn(d.company.legalName) || "My Business";
    let business = await tx.business.findFirst({ where: { tenantId: user.tenantId, isDefault: true } });
    if (!business) business = await tx.business.create({ data: { tenantId: user.tenantId, name: bizName, isDefault: true, status: "active" } });
    const businessId = business.id;
    await tx.companySetup.update({ where: { id: setup.id }, data: { businessId } });

    const bankRow = (bk: Record<string, unknown>, branchId: number | null) => ({
      setupId: setup.id, businessId, branchId,
      bankName: nn(bk.bankName), branch: nn(bk.branch), account: nn(bk.account),
      ifsc: nn(bk.ifsc)?.toUpperCase() ?? null, type: nn(bk.type), upi: nn(bk.upi),
    });
    // Company-level bank accounts (Banking Setup step) — businessId set, branchId NULL.
    if (d.banks.length)
      await tx.setupBank.createMany({ data: d.banks.map((b) => bankRow(b, null)) });

    // Sync the wizard's branches into the branches table (upsert by code). The
    // first branch is the business's primary (default) — it overwrites the
    // auto-created Main Branch so there is no stray placeholder.
    const wiz = d.branches as Array<Record<string, unknown>>;
    // Entity types: seed defaults for a brand-new tenant, then resolve the chosen
    // "Entity Type" name → entityTypeId (keeps the legacy `type` column = the name).
    await ensureEntityTypesSeeded(tx, user.tenantId);
    const etByName = new Map((await tx.entityType.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } })).map((e) => [e.name.toLowerCase(), e.id]));
    const resolveEt = (raw: string) => etByName.get(raw.toLowerCase()) ?? etByName.get((LEGACY_TYPE_ALIAS[raw.toLowerCase()] ?? "").toLowerCase()) ?? null;
    const mapBranch = (b: Record<string, unknown>, i: number) => {
      const typeName = nn(b.type) || "Retail Store";
      return {
        name: nn(b.name) || `Branch ${i + 1}`, code: nn(b.code) || `BR-${i + 1}`, type: typeName, entityTypeId: resolveEt(typeName),
        gstin: nn(b.gstin)?.toUpperCase() || null, address: nn(b.address), city: nn(b.city), state: nn(b.state), pincode: nn(b.pincode),
        openTime: nn(b.openTime), closeTime: nn(b.closeTime), manager: nn(b.manager), contactPerson: nn(b.contactPerson),
        phone: nn(b.phone), email: nn(b.email),
      };
    };
    const branchIds: number[] = [];
    if (wiz.length) {
      const primary = (await tx.branch.findFirst({ where: { businessId, isDefault: true } }))
        ?? (await tx.branch.findFirst({ where: { businessId }, orderBy: { id: "asc" } }));
      for (let i = 0; i < wiz.length; i++) {
        const data = mapBranch(wiz[i], i);
        if (i === 0 && primary) {
          await tx.branch.update({ where: { id: primary.id }, data: { ...data, isDefault: true } });
          branchIds[i] = primary.id;
        } else {
          const existing = await tx.branch.findFirst({ where: { businessId, code: data.code } });
          if (existing) { await tx.branch.update({ where: { id: existing.id }, data }); branchIds[i] = existing.id; }
          else { const created = await tx.branch.create({ data: { tenantId: user.tenantId, businessId, isDefault: false, status: "active", ...data } }); branchIds[i] = created.id; }
        }
      }
      // Second pass: link parents by the wizard's parentCode, then rebuild the tree.
      const idByCode = new Map<string, number>();
      wiz.forEach((b, i) => { const c = nn(b.code); if (c && branchIds[i]) idByCode.set(c, branchIds[i]); });
      for (let i = 0; i < wiz.length; i++) {
        const pc = nn((wiz[i] as Record<string, unknown>).parentCode);
        const pid = pc ? idByCode.get(pc) : null;
        await tx.branch.update({ where: { id: branchIds[i] }, data: { parentBranchId: pid && pid !== branchIds[i] ? pid : null } });
      }
    } else if (!(await tx.branch.findFirst({ where: { businessId } }))) {
      await tx.branch.create({ data: { tenantId: user.tenantId, businessId, name: "Main Branch", code: "MAIN", type: "Head Office", entityTypeId: resolveEt("Head Office"), isDefault: true, status: "active" } });
    }
    // Recompute hierarchyLevel + hierarchyPath for the whole business.
    await rebuildHierarchy(tx, businessId);

    // Branch-level bank accounts (Branch Setup step) — businessId + branchId set.
    for (let i = 0; i < wiz.length; i++) {
      const banks = (wiz[i].banks as Array<Record<string, unknown>> | undefined) ?? [];
      const rows = banks.filter((bk) => nn(bk.bankName) || nn(bk.account)).map((bk) => bankRow(bk, branchIds[i]));
      if (rows.length) await tx.setupBank.createMany({ data: rows });
    }

    // On completion: finalize business details. (The tenant account name is left
    // unchanged — Business Setup configures the business, not the account.)
    if (d.status === "completed") {
      await tx.business.update({ where: { id: businessId }, data: { name: bizName, legalName: nn(d.company.legalName), gstNumber: parentData.gstNumber, pan: parentData.pan, logoUrl: parentData.logoUrl } });
    }
    return { setupId: setup.id, businessId };
  });

  await writeAudit(prisma, user, {
    action: d.status === "completed" ? "company_setup.complete" : "company_setup.update", entity: "CompanySetup", entityId: result.setupId,
    summary: d.status === "completed" ? `Completed company setup for ${nn(d.company.name) ?? "business"}` : `Saved company setup draft (step ${d.currentStep})`,
    meta: { status: d.status, mode: d.mode || "standard", currentStep: d.currentStep, companyName: nn(d.company.name), branches: d.branches.length, warehouses: d.warehouses.length },
    businessId: result.businessId, ip: requestMeta(req).ip,
  });

  return NextResponse.json({
    ok: true,
    message: d.status === "completed" ? "Setup completed." : "Draft saved.",
    setupId: result.setupId,
    status: d.status,
  });
}
