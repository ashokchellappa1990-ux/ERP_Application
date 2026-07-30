import {
  Layers,
  Tags,
  Factory,
  Ruler,
  FolderTree,
  Boxes,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */

export interface MasterField {
  name: string;
  label: string;
  icon?: LucideIcon;
  type?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  /** Pull select options live from another master entity (by slug). */
  optionsFrom?: string;
  /** Filter the optionsFrom records where record[byField] === form[byField]. */
  optionsFilter?: { byField: string };
  info?: string;
  sample?: string;
  full?: boolean;
}

export interface MasterColumn {
  key: string;
  label: string;
}

export type MasterRow = Record<string, string> & { id: string };

export interface MasterEntity {
  slug: string;
  singular: string;
  plural: string;
  icon: LucideIcon;
  description: string;
  fields: MasterField[];
  columns: MasterColumn[];
  seed: MasterRow[];
}

const opt = (arr: string[]) => arr.map((x) => ({ value: x, label: x }));
const STATUS: MasterField = {
  name: "status",
  label: "Status",
  type: "select",
  options: opt(["Active", "Inactive"]),
  info: "Active records are usable across the app.",
};
const CATEGORY_NAMES = ["Grocery", "Beverages", "Personal Care", "Household", "Pharmacy", "Electronics", "Textile", "Stationery"];

/* =========================================================== entities == */

export const MASTERS: Record<string, MasterEntity> = {
  category: {
    slug: "category",
    singular: "Category",
    plural: "Categories",
    icon: Layers,
    description: "Top-level product categories for navigation & reporting.",
    fields: [
      { name: "name", label: "Category Name *", icon: Layers, info: "Display name of the category.", sample: "Grocery" },
      { name: "code", label: "Category Code", icon: Tags, info: "Short unique code.", sample: "CAT-01" },
      { name: "description", label: "Description", info: "Optional description.", sample: "Daily grocery items", type: "textarea", full: true },
      STATUS,
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
    ],
    seed: CATEGORY_NAMES.map((n, i) => ({
      id: `category-${i + 1}`,
      name: n,
      code: `CAT-${String(i + 1).padStart(2, "0")}`,
      description: "",
      status: "Active",
    })),
  },

  subcategory: {
    slug: "subcategory",
    singular: "Sub Category",
    plural: "Sub Categories",
    icon: FolderTree,
    description: "Finer groupings under each category.",
    fields: [
      { name: "name", label: "Sub Category Name *", icon: FolderTree, info: "Display name.", sample: "Biscuits" },
      { name: "code", label: "Code", icon: Tags, info: "Short unique code.", sample: "SUB-01" },
      { name: "category", label: "Parent Category *", icon: Layers, type: "select", optionsFrom: "category", info: "Category this sub category maps to." },
      STATUS,
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "category", label: "Parent Category" },
    ],
    seed: [
      ["Biscuits", "Grocery"],
      ["Milk & Dairy", "Grocery"],
      ["Oral Care", "Personal Care"],
      ["Detergents", "Household"],
      ["Tablets", "Pharmacy"],
      ["Mobiles", "Electronics"],
    ].map(([n, c], i) => ({
      id: `subcategory-${i + 1}`,
      name: n,
      code: `SUB-${String(i + 1).padStart(2, "0")}`,
      category: c,
      status: "Active",
    })),
  },

  group: {
    slug: "group",
    singular: "Group",
    plural: "Groups",
    icon: Boxes,
    description: "Cross-category product groups (e.g. FMCG, Durables).",
    fields: [
      { name: "name", label: "Group Name *", icon: Boxes, info: "Display name of the group.", sample: "FMCG" },
      { name: "code", label: "Group Code", icon: Tags, info: "Short unique code.", sample: "GRP-01" },
      { name: "category", label: "Category *", icon: Layers, type: "select", optionsFrom: "category", info: "Category this group maps to (by category code)." },
      { name: "description", label: "Description", info: "Optional description.", sample: "Fast-moving consumer goods", type: "textarea", full: true },
      STATUS,
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "category", label: "Category" },
    ],
    seed: [
      ["FMCG", "Grocery"],
      ["Durables", "Electronics"],
      ["Consumables", "Household"],
      ["Apparel", "Textile"],
    ].map(([n, c], i) => ({
      id: `group-${i + 1}`,
      name: n,
      code: `GRP-${String(i + 1).padStart(2, "0")}`,
      category: c,
      description: "",
      status: "Active",
    })),
  },

  brand: {
    slug: "brand",
    singular: "Brand",
    plural: "Brands",
    icon: Tags,
    description: "Product brands and their owners.",
    fields: [
      { name: "name", label: "Brand Name *", icon: Tags, info: "Display name of the brand.", sample: "Parle" },
      { name: "code", label: "Brand Code", icon: Tags, info: "Short unique code.", sample: "BRD-01" },
      { name: "category", label: "Category *", icon: Layers, type: "select", optionsFrom: "category", info: "Category this brand maps to (by category code)." },
      { name: "group", label: "Group *", icon: Boxes, type: "select", optionsFrom: "group", optionsFilter: { byField: "category" }, info: "Group within the selected category. Pick a category first." },
      { name: "manufacturer", label: "Manufacturer", icon: Factory, info: "Company that owns the brand.", sample: "Parle Products" },
      { name: "description", label: "Description", info: "Optional description.", type: "textarea", full: true },
      STATUS,
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "category", label: "Category" },
      { key: "group", label: "Group" },
    ],
    seed: [
      ["Parle", "Grocery", "FMCG", "Parle Products"],
      ["Amul", "Grocery", "FMCG", "Amul (GCMMF)"],
      ["Colgate", "Household", "Consumables", "Colgate-Palmolive"],
      ["Surf Excel", "Household", "Consumables", "HUL"],
      ["Tata", "Grocery", "FMCG", "Tata Consumer"],
      ["Samsung", "Electronics", "Durables", "Samsung India"],
      ["Classmate", "Textile", "Apparel", "ITC Ltd"],
    ].map(([n, c, g, m], i) => ({
      id: `brand-${i + 1}`,
      name: n,
      code: `BRD-${String(i + 1).padStart(2, "0")}`,
      category: c,
      group: g,
      manufacturer: m,
      description: "",
      status: "Active",
    })),
  },

  manufacturer: {
    slug: "manufacturer",
    singular: "Manufacturer",
    plural: "Manufacturers",
    icon: Factory,
    description: "Companies that manufacture your products.",
    fields: [
      { name: "name", label: "Manufacturer Name *", icon: Factory, info: "Legal / display name.", sample: "Parle Products Pvt Ltd" },
      { name: "code", label: "Code", icon: Tags, info: "Short unique code.", sample: "MFG-01" },
      { name: "contact", label: "Contact Person", info: "Primary contact.", sample: "R. Mehta" },
      { name: "mobile", label: "Mobile", info: "Contact number.", sample: "+91 98765 43210" },
      STATUS,
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "contact", label: "Contact" },
    ],
    seed: ["Parle Products", "Amul (GCMMF)", "Colgate-Palmolive", "HUL", "Tata Consumer", "Samsung India"].map((n, i) => ({
      id: `manufacturer-${i + 1}`,
      name: n,
      code: `MFG-${String(i + 1).padStart(2, "0")}`,
      contact: "",
      mobile: "",
      status: "Active",
    })),
  },

  uom: {
    slug: "uom",
    singular: "Unit",
    plural: "Units (UOM)",
    icon: Ruler,
    description: "Units of measure for stock, purchase and sales.",
    fields: [
      { name: "name", label: "Unit Name *", icon: Ruler, info: "Full name of the unit.", sample: "Piece" },
      { name: "symbol", label: "Symbol", icon: Tags, info: "Short symbol used on documents.", sample: "PC" },
      { name: "type", label: "Unit Type", type: "select", options: opt(["Base", "Derived"]), info: "Base units stand alone; derived units convert from a base." },
      { name: "conversion", label: "Conversion Factor", info: "How many base units this equals (derived only).", sample: "1" },
      STATUS,
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "symbol", label: "Symbol" },
      { key: "type", label: "Type" },
    ],
    seed: [
      ["Piece", "PC", "Base"],
      ["Box", "BX", "Derived"],
      ["Kilogram", "KG", "Base"],
      ["Gram", "G", "Derived"],
      ["Litre", "L", "Base"],
      ["Millilitre", "ML", "Derived"],
      ["Dozen", "DZ", "Derived"],
      ["Packet", "PKT", "Derived"],
    ].map(([n, s, t], i) => ({
      id: `uom-${i + 1}`,
      name: n,
      symbol: s,
      type: t,
      conversion: t === "Base" ? "1" : "",
      status: "Active",
    })),
  },
};

export function getEntity(slug: string): MasterEntity | null {
  return MASTERS[slug] ?? null;
}
