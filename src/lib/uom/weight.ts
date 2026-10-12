/**
 * Weight UOM conversions.
 *
 * The ERP stores quantities in a product's BASE unit of measure (a free string
 * like "Kg"). When that unit is a WEIGHT unit, this module lets the UI show the
 * same quantity in other weight units (Gram / Quintal / Ton …) and convert a
 * value typed in another unit back to the base unit for storage.
 *
 * All factors are expressed relative to 1 kilogram, so any pair converts through
 * kg: value_to = value_from × (kg_from / kg_to).
 */

export interface WeightUnit {
  key: string;    // canonical key
  label: string;  // display label
  kg: number;     // how many kilograms in ONE of this unit
  aliases: string[]; // accepted spellings (matched case/space-insensitively)
}

/** Ordered smallest → largest. `label` is what the UI shows. */
const UNITS: WeightUnit[] = [
  { key: "mg", label: "mg", kg: 0.000001, aliases: ["mg", "milligram", "milligrams"] },
  { key: "g", label: "Gram", kg: 0.001, aliases: ["g", "gm", "gms", "gram", "grams"] },
  { key: "kg", label: "Kg", kg: 1, aliases: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"] },
  { key: "quintal", label: "Quintal", kg: 100, aliases: ["quintal", "quintals", "qtl", "q"] },
  { key: "ton", label: "Ton", kg: 1000, aliases: ["ton", "tons", "tonne", "tonnes", "mt", "metricton"] },
  { key: "lb", label: "Lb", kg: 0.45359237, aliases: ["lb", "lbs", "pound", "pounds"] },
];

/** Units shown in the conversion breakdown + offered in the unit picker. */
export const WEIGHT_DISPLAY_KEYS = ["g", "kg", "quintal", "ton"] as const;

const BY_KEY = new Map(UNITS.map((u) => [u.key, u]));
const ALIAS = new Map<string, WeightUnit>();
for (const u of UNITS) for (const a of u.aliases) ALIAS.set(a, u);

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** Resolve a free-text uom (e.g. "Kg", "kgs", "Quintal") to its unit, or null. */
export function resolveWeightUnit(uom: string | null | undefined): WeightUnit | null {
  return ALIAS.get(norm(uom)) ?? null;
}

/** True when the uom string denotes a weight unit we can convert. */
export function isWeightUom(uom: string | null | undefined): boolean {
  return resolveWeightUnit(uom) != null;
}

/** Canonical display label for a weight uom (e.g. "kgs" → "Kg"), or the input as-is. */
export function weightLabel(uom: string | null | undefined): string {
  return resolveWeightUnit(uom)?.label ?? (uom ?? "");
}

/**
 * Convert a value between two weight units (accepts either canonical keys or free
 * uom strings). Returns null if either unit isn't a recognised weight unit.
 */
export function convertWeight(value: number, from: string, to: string): number | null {
  const f = BY_KEY.get(from) ?? resolveWeightUnit(from);
  const t = BY_KEY.get(to) ?? resolveWeightUnit(to);
  if (!f || !t || !Number.isFinite(value)) return null;
  return (value * f.kg) / t.kg;
}

export interface WeightConversion { key: string; label: string; value: number }

/**
 * The `value` (given in `uom`) expressed in every display unit. Used for the
 * read-only conversion table. Returns [] when `uom` isn't a weight unit.
 */
export function weightBreakdown(value: number, uom: string): WeightConversion[] {
  const src = resolveWeightUnit(uom);
  if (!src || !Number.isFinite(value)) return [];
  return WEIGHT_DISPLAY_KEYS.map((k) => {
    const u = BY_KEY.get(k)!;
    return { key: u.key, label: u.label, value: (value * src.kg) / u.kg };
  });
}

/** Units offered in the "change" picker (display set + the base unit if outside it). */
export function weightUnitOptions(baseUom: string): { key: string; label: string }[] {
  const base = resolveWeightUnit(baseUom);
  const keys = new Set<string>(WEIGHT_DISPLAY_KEYS as unknown as string[]);
  if (base) keys.add(base.key);
  return [...keys].map((k) => BY_KEY.get(k)!).sort((a, b) => a.kg - b.kg).map((u) => ({ key: u.key, label: u.label }));
}

/** Trim floating noise for display (up to 6 sig places, no trailing zeros). */
export function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.abs(n) >= 1 ? +n.toFixed(3) : +n.toPrecision(4);
  return String(r);
}
