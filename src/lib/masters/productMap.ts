import {
  PRODUCT_STRING_FIELDS, PRODUCT_DATE_FIELDS, PRODUCT_DECIMAL_FIELDS, PRODUCT_INT_FIELDS,
  PRODUCT_TOGGLE_COLS, PRODUCT_FLAG_COLS,
} from "./productFields";
import { generateSku } from "./variantCodes";

const nn = (s: unknown) => {
  const v = typeof s === "string" ? s.trim() : s == null ? "" : String(s).trim();
  return v ? v : null;
};
const dec = (s: unknown) => {
  const t = typeof s === "string" ? s.trim() : s;
  if (t === "" || t == null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const intv = (s: unknown) => {
  const t = typeof s === "string" ? s.trim() : s;
  if (t === "" || t == null) return null;
  const n = parseInt(String(t), 10);
  return Number.isFinite(n) ? n : null;
};

interface FormPayload {
  fields?: Record<string, unknown>;
  toggles?: Record<string, Record<string, boolean>>;
  flags?: Record<string, boolean>;
  approvalStatus?: string;
}

/** Build the flat DB column object from the editor's nested form payload. */
export function fieldsToColumns(data: FormPayload): Record<string, unknown> {
  const f = data.fields ?? {};
  const cols: Record<string, unknown> = {};
  for (const k of PRODUCT_STRING_FIELDS) cols[k] = nn(f[k]);
  for (const k of PRODUCT_DATE_FIELDS) cols[k] = nn(f[k]);
  for (const k of PRODUCT_DECIMAL_FIELDS) cols[k] = dec(f[k]);
  for (const k of PRODUCT_INT_FIELDS) cols[k] = intv(f[k]);
  for (const [c, g, id] of PRODUCT_TOGGLE_COLS) cols[c] = !!data.toggles?.[g]?.[id];
  for (const [c, fl] of PRODUCT_FLAG_COLS) cols[c] = !!data.flags?.[fl];
  cols.name = nn(f.name) ?? "";
  cols.status = nn(f.status) ?? "Active";
  cols.approvalStatus = nn(data.approvalStatus) ?? "draft";
  return cols;
}

interface VariantInput {
  label?: string;
  dims?: { name?: string; value?: string }[];
  sku?: string;
  barcode?: string;
  mrp?: string;
  openingStock?: string;
  status?: string;
}
interface ChildRow {
  id: number;
  name: string;
  code: string | null;
  sku: string | null;
  barcode: string | null;
  mrp: unknown;
  openingQty: unknown;
  status: string;
  attributes?: { name: string | null; type: string | null; values: string | null }[];
}

/**
 * Build a CHILD product's column object from a variant + the parent's columns.
 * Each variant becomes a full product record (own SKU) that inherits the parent's
 * shared fields (category, brand, tax, toggles…) and overrides the variant-specific
 * ones. Its size/colour dimensions are returned as attributes (stored separately).
 * Barcode is left null and generated from the child's id after insert.
 */
export function variantToChild(parentCols: Record<string, unknown>, parentName: string, parentCode: string, v: VariantInput) {
  const dims = v.dims ?? [];
  const label = v.label?.trim() || dims.map((d) => d.value).join(" / ");
  const sku = nn(v.sku) ?? generateSku({
    category: parentCols.category as string | null,
    subCategory: parentCols.subCategory as string | null,
    group: parentCols.group as string | null,
    name: parentName,
    code: parentCode,
    dims,
  });
  const cols: Record<string, unknown> = {
    ...parentCols,
    name: `${parentName} - ${label}`.slice(0, 250),
    code: sku,
    sku,
    barcode: null,
    mrp: dec(v.mrp),
    openingQty: dec(v.openingStock),
    openingValue: null,
    status: nn(v.status) ?? "Active",
  };
  const attributes = dims
    .filter((d) => (d.name ?? "").trim())
    .map((d) => ({ name: d.name || null, type: "variant", values: d.value || null }));
  return { cols, attributes };
}

/**
 * Derive variant combinations directly from the attributes (Size, Colour…),
 * merging same-named attributes. Used as a fallback so that defining multi-value
 * attributes always yields separate variant records even if the user didn't
 * click "Generate Variants". Returns [] when there's only a single combination.
 */
export function attributesToVariants(attributes: { name?: string; values?: string }[]): VariantInput[] {
  const dimMap = new Map<string, { name: string; values: string[] }>();
  for (const a of attributes) {
    const name = (a.name ?? "").trim();
    if (!name) continue;
    const vals = (a.values ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    if (!vals.length) continue;
    const key = name.toLowerCase();
    if (!dimMap.has(key)) dimMap.set(key, { name, values: [] });
    const dim = dimMap.get(key)!;
    for (const v of vals) if (!dim.values.includes(v)) dim.values.push(v);
  }
  const dims = Array.from(dimMap.values()).slice(0, 3);
  let combos: { name: string; value: string }[][] = [[]];
  for (const d of dims) {
    const next: { name: string; value: string }[][] = [];
    for (const c of combos) for (const v of d.values) next.push([...c, { name: d.name, value: v }]);
    combos = next;
  }
  if (combos.length <= 1) return [];
  return combos.map((dimsArr) => ({
    label: dimsArr.map((x) => x.value).join(" / "),
    dims: dimsArr,
    sku: "",
    barcode: "",
    mrp: "",
    openingStock: "0",
    status: "Active",
  }));
}

/** Reconstruct the editor's variant rows from the parent's child product records. */
export function childrenToVariants(children: ChildRow[]) {
  return children.map((c) => {
    const dims = (c.attributes ?? [])
      .filter((a) => a.type === "variant")
      .map((a) => ({ name: a.name ?? "", value: a.values ?? "" }));
    const label = dims.map((d) => d.value).join(" / ") || c.name || "";
    return {
      id: `dbc-${c.id}`,
      label,
      dims,
      sku: c.sku ?? c.code ?? "",
      barcode: c.barcode ?? "",
      mrp: c.mrp != null ? String(Number(c.mrp)) : "",
      openingStock: c.openingQty != null ? String(Number(c.openingQty)) : "",
      status: c.status ?? "Active",
    };
  });
}

/** Reconstruct the editor's nested form shape from a DB row (+ attributes + child variants). */
export function rowToFormData(row: Record<string, unknown> & { attributes?: { id: number; name: string | null; type: string | null; values: string | null }[]; children?: ChildRow[] }) {
  const fields: Record<string, string> = {};
  for (const k of [...PRODUCT_STRING_FIELDS, ...PRODUCT_DATE_FIELDS]) fields[k] = (row[k] as string) ?? "";
  for (const k of [...PRODUCT_DECIMAL_FIELDS, ...PRODUCT_INT_FIELDS]) fields[k] = row[k] != null ? String(Number(row[k])) : "";

  const toggles: Record<string, Record<string, boolean>> = {};
  for (const [c, g, id] of PRODUCT_TOGGLE_COLS) (toggles[g] ??= {})[id] = !!row[c];
  const flags: Record<string, boolean> = {};
  for (const [c, fl] of PRODUCT_FLAG_COLS) flags[fl] = !!row[c];

  return {
    fields,
    toggles,
    flags,
    attributes: (row.attributes ?? []).map((a) => ({ id: `db-${a.id}`, name: a.name ?? "", type: a.type ?? "", values: a.values ?? "" })),
    variants: childrenToVariants(row.children ?? []),
    customOptions: {},
    approvalStatus: (row.approvalStatus as string) || "draft",
  };
}
