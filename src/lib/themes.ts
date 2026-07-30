/**
 * Theme registry for One ERP.
 * Each theme maps to a `data-theme` block in src/styles/tokens.css.
 * `swatch` values are only used for the theme-picker preview chips.
 */

export type ThemeId =
  | "oneerp"
  | "corporate"
  | "emerald-green"
  | "retail-orange"
  | "modern-dark"
  | "pharmacy";

export type Density = "comfortable" | "touch";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  /** [primary, secondary, accent] for preview chips */
  swatch: [string, string, string];
  dark?: boolean;
  /** Light (white) sidebar instead of the default dark menu. */
  lightSidebar?: boolean;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "oneerp",
    name: "One ERP",
    description: "One ERP brand — corporate blue with a lime-green accent.",
    swatch: ["#1B75BC", "#7AB317", "#F5A623"],
    lightSidebar: true,
  },
  {
    id: "corporate",
    name: "Indigo Modern",
    description: "Clean indigo + cyan on a light sidebar. The default One ERP look.",
    swatch: ["#4338CA", "#06B6D4", "#F59E0B"],
    lightSidebar: true,
  },
  {
    id: "emerald-green",
    name: "Emerald Green",
    description: "Fresh and calm. Great for grocery & agri retail.",
    swatch: ["#0F766E", "#10B981", "#F59E0B"],
  },
  {
    id: "retail-orange",
    name: "Retail Orange",
    description: "Energetic and high-conversion for fast retail.",
    swatch: ["#EA580C", "#0F4C81", "#FFB800"],
  },
  {
    id: "modern-dark",
    name: "Modern Dark",
    description: "Low-glare dark mode for long POS shifts.",
    swatch: ["#3B82F6", "#06B6D4", "#FBBF24"],
    dark: true,
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    description: "Clinical teal with high legibility for medical stores.",
    swatch: ["#047481", "#2563EB", "#00C2A8"],
  },
];

export const DEFAULT_THEME: ThemeId = "corporate";

export function isThemeId(value: string | null): value is ThemeId {
  return !!value && THEMES.some((t) => t.id === value);
}
