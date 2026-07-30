/**
 * Product branding defaults + helpers.
 *
 * The live brand name / logo is served from the portal system setting
 * (Website CMS → Theme & Identity: productName / logoText / logoUrl) and applied
 * app-wide through <ThemeProvider>'s `brand` context. These constants are the
 * factory fallback used before that setting loads (and when it is unset).
 */
export const DEFAULT_PRODUCT_NAME = "Oasys ERP";
export const DEFAULT_TAGLINE = "Retail ERP";

/**
 * Split a product name into two parts for the two-tone wordmark
 * (first word normal, remainder accented). "Oasys ERP" -> ["Oasys", "Orbit"].
 */
export function splitBrandName(name?: string): [string, string] {
  const n = (name || DEFAULT_PRODUCT_NAME).trim();
  const i = n.indexOf(" ");
  if (i === -1) return [n, ""];
  return [n.slice(0, i), n.slice(i + 1)];
}
