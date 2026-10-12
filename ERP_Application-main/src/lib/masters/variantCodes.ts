/** Backend generation of variant SKU and barcode (server-only, no UI deps). */

function abbr(s: string, n = 4): string {
  const t = (s || "").trim().replace(/[^a-zA-Z0-9]/g, "");
  return (t.length <= n ? t : t.slice(0, n)).toUpperCase();
}

export interface SkuParts {
  category?: string | null;
  subCategory?: string | null;
  group?: string | null;
  name?: string | null;
  code?: string | null;
  dims?: { name?: string; value?: string }[];
}

/**
 * Deterministic SKU built from a COMBINATION of the product's classification and
 * attributes: Category · Sub-category · Product name · each variant dimension.
 * e.g. Textile / Shirts / "Polo T-Shirt" / Blue / M → "TEX-SHI-POLO-BLUE-M".
 */
export function generateSku(parts: SkuParts): string {
  const out: string[] = [];
  if (parts.category) out.push(abbr(parts.category, 3));
  if (parts.subCategory) out.push(abbr(parts.subCategory, 3));
  const base = abbr(parts.name || parts.code || "", 4);
  if (base) out.push(base);
  for (const d of parts.dims ?? []) {
    const a = abbr(d.value ?? "", 4);
    if (a) out.push(a);
  }
  if (!out.length) out.push("ITEM");
  return out.join("-");
}

/** Append the EAN-13 check digit to a 12-digit body. */
function ean13(body12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body12[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return body12 + check;
}

/** Unique, stable EAN-13 barcode derived from the variant's DB id (store-internal "20" prefix). */
export function generateBarcode(variantId: number): string {
  const body = ("20" + String(variantId).padStart(10, "0")).slice(0, 12);
  return ean13(body);
}
