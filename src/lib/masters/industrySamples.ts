/**
 * Industry-aware sample values for the Product Master fields, plus a lightweight
 * "AI" generator for Search Keywords & Description based on the product name.
 * The active industry comes from Business Setup so the placeholders/examples a
 * user sees match their trade.
 */

export type SampleSet = Record<string, string>;

const SETS: Record<string, SampleSet> = {
  grocery: {
    name: "Parle-G Biscuit 100g", shortName: "Parle-G 100g", altName: "Parle Glucose 100g",
    keywords: "biscuit, glucose, parle, snacks", description: "Glucose biscuits, 100g pack — everyday snack.",
    category: "Grocery", subCategory: "Biscuits", group: "FMCG", brand: "Parle", manufacturer: "Parle Products",
    family: "Glucose Biscuits", segment: "Mass", hsn: "1905", gstRate: "18%", mrp: "10.00", retailPrice: "10.00",
    wholesalePrice: "9.20", sku: "PARLE-G-100", baseUom: "Packet", packageType: "Packet",
    salesDesc: "Parle-G Glucose Biscuit 100g", purchaseDesc: "Parle-G 100g — case of 24", preferredSupplier: "Metro Cash & Carry",
  },
  pharmacy: {
    name: "Paracetamol 500mg Tablet", shortName: "Para 500", altName: "Acetaminophen 500mg",
    keywords: "paracetamol, fever, pain, tablet, 500mg", description: "Paracetamol 500mg tablets — fever & pain relief. Strip of 10.",
    category: "Pharmacy", subCategory: "Tablets", group: "Consumables", brand: "Calpol", manufacturer: "GSK Pharma",
    family: "Analgesics", segment: "OTC", hsn: "3004", gstRate: "12%", mrp: "30.00", retailPrice: "28.00",
    wholesalePrice: "24.00", sku: "PARA-500-10", baseUom: "Strip", packageType: "Box",
    salesDesc: "Paracetamol 500mg — strip of 10 tablets", purchaseDesc: "Paracetamol 500mg — box of 100 strips", preferredSupplier: "Reliance Distributors",
  },
  textile: {
    name: "Men's Cotton Shirt – Blue (M)", shortName: "Cotton Shirt M", altName: "Blue Formal Shirt",
    keywords: "shirt, cotton, men, formal, blue, medium", description: "Men's full-sleeve cotton formal shirt, blue, size M.",
    category: "Textile", subCategory: "Shirts", group: "Apparel", brand: "Peter England", manufacturer: "Aditya Birla Fashion",
    family: "Formal Wear", segment: "Premium", hsn: "6205", gstRate: "5%", mrp: "1299.00", retailPrice: "1099.00",
    wholesalePrice: "850.00", sku: "SHRT-BLU-M", baseUom: "Piece", packageType: "Piece",
    salesDesc: "Men's Cotton Formal Shirt — Blue, M", purchaseDesc: "Cotton Shirt assorted sizes — pack of 12", preferredSupplier: "Direct from Brand",
  },
  footwear: {
    name: "Nike Revolution Running Shoe (UK 8)", shortName: "Nike Revolution 8", altName: "Nike Running Shoe",
    keywords: "shoe, nike, running, sports, footwear, uk8", description: "Nike Revolution running shoes, men's, UK size 8.",
    category: "Footwear", subCategory: "Sports Shoes", group: "Apparel", brand: "Nike", manufacturer: "Nike India",
    family: "Running", segment: "Premium", hsn: "6404", gstRate: "18%", mrp: "3995.00", retailPrice: "3499.00",
    wholesalePrice: "2900.00", sku: "NIKE-REV-8", baseUom: "Pair", packageType: "Box",
    salesDesc: "Nike Revolution Running Shoe — UK 8", purchaseDesc: "Nike Revolution assorted sizes — case of 10", preferredSupplier: "Direct from Brand",
  },
  electronics: {
    name: "Samsung 25W USB-C Charger", shortName: "Samsung 25W", altName: "Samsung Fast Charger 25W",
    keywords: "charger, samsung, 25w, usb-c, fast charging, mobile", description: "Samsung 25W USB-C super-fast charging adapter with cable.",
    category: "Electronics", subCategory: "Mobiles", group: "Durables", brand: "Samsung", manufacturer: "Samsung India",
    family: "Mobile Accessories", segment: "Premium", hsn: "8504", gstRate: "18%", mrp: "1499.00", retailPrice: "1399.00",
    wholesalePrice: "1180.00", sku: "SMSNG-25W", baseUom: "Piece", packageType: "Box",
    salesDesc: "Samsung 25W USB-C Charger", purchaseDesc: "Samsung 25W Charger — carton of 20", preferredSupplier: "Reliance Distributors",
  },
  furniture: {
    name: "Engineered Wood Office Chair", shortName: "Office Chair", altName: "Ergonomic Chair",
    keywords: "chair, office, furniture, ergonomic, wood", description: "Ergonomic engineered-wood office chair with cushioned seat.",
    category: "Furniture", subCategory: "Chairs", group: "Durables", brand: "Nilkamal", manufacturer: "Nilkamal Ltd",
    family: "Office Furniture", segment: "Mass", hsn: "9401", gstRate: "18%", mrp: "4999.00", retailPrice: "4299.00",
    wholesalePrice: "3600.00", sku: "CHAIR-OFC-01", baseUom: "Piece", packageType: "Carton",
    salesDesc: "Engineered Wood Office Chair", purchaseDesc: "Office Chair — knock-down pack", preferredSupplier: "Local Wholesaler",
  },
  hardware: {
    name: "Asian Paints Apex 1L White", shortName: "Apex 1L White", altName: "Exterior Emulsion 1L",
    keywords: "paint, asian paints, apex, exterior, white, 1 litre", description: "Asian Paints Apex exterior emulsion, white, 1 litre.",
    category: "Hardware", subCategory: "Paints", group: "Consumables", brand: "Asian Paints", manufacturer: "Asian Paints Ltd",
    family: "Exterior Paints", segment: "Mass", hsn: "3209", gstRate: "18%", mrp: "499.00", retailPrice: "459.00",
    wholesalePrice: "390.00", sku: "APEX-1L-WHT", baseUom: "Bottle", packageType: "Carton",
    salesDesc: "Asian Paints Apex 1L — White", purchaseDesc: "Apex 1L — carton of 12", preferredSupplier: "Local Wholesaler",
  },
  cosmetics: {
    name: "Lakmé 9to5 Lipstick – Red", shortName: "Lakmé Lipstick", altName: "9to5 Matte Lipstick",
    keywords: "lipstick, lakme, cosmetics, red, matte, makeup", description: "Lakmé 9to5 matte lipstick, red shade, long-lasting.",
    category: "Cosmetics", subCategory: "Makeup", group: "FMCG", brand: "Lakmé", manufacturer: "HUL",
    family: "Lip Care", segment: "Premium", hsn: "3304", gstRate: "18%", mrp: "550.00", retailPrice: "499.00",
    wholesalePrice: "410.00", sku: "LKM-LIP-RED", baseUom: "Piece", packageType: "Box",
    salesDesc: "Lakmé 9to5 Lipstick — Red", purchaseDesc: "Lakmé Lipstick assorted — box of 24", preferredSupplier: "Direct from Brand",
  },
  automobile: {
    name: "Bosch Spark Plug (Set of 4)", shortName: "Bosch Spark Plug", altName: "Ignition Spark Plug",
    keywords: "spark plug, bosch, automobile, ignition, spare", description: "Bosch spark plugs, set of 4, for petrol engines.",
    category: "Automobile", subCategory: "Engine Parts", group: "Durables", brand: "Bosch", manufacturer: "Bosch India",
    family: "Ignition", segment: "OEM", hsn: "8511", gstRate: "28%", mrp: "640.00", retailPrice: "580.00",
    wholesalePrice: "470.00", sku: "BOSCH-SP-4", baseUom: "Box", packageType: "Box",
    salesDesc: "Bosch Spark Plug — set of 4", purchaseDesc: "Bosch Spark Plugs — carton of 20 sets", preferredSupplier: "Reliance Distributors",
  },
  stationery: {
    name: "Classmate Notebook 200 Pages", shortName: "Classmate 200pg", altName: "Long Notebook 200pg",
    keywords: "notebook, classmate, stationery, 200 pages, school", description: "Classmate single-line notebook, 200 pages.",
    category: "Stationery", subCategory: "Notebooks", group: "Consumables", brand: "Classmate", manufacturer: "ITC Ltd",
    family: "Notebooks", segment: "Mass", hsn: "4820", gstRate: "12%", mrp: "65.00", retailPrice: "60.00",
    wholesalePrice: "50.00", sku: "CM-NB-200", baseUom: "Piece", packageType: "Packet",
    salesDesc: "Classmate Notebook 200 Pages", purchaseDesc: "Classmate Notebook — pack of 12", preferredSupplier: "Metro Cash & Carry",
  },
  sports: {
    name: "SG English Willow Cricket Bat", shortName: "SG Cricket Bat", altName: "English Willow Bat",
    keywords: "cricket bat, sg, sports, english willow, fitness", description: "SG English-willow cricket bat, full size, ready to play.",
    category: "Sports", subCategory: "Cricket", group: "Durables", brand: "SG", manufacturer: "Sanspareils Greenlands",
    family: "Cricket Gear", segment: "Premium", hsn: "9506", gstRate: "12%", mrp: "5999.00", retailPrice: "5299.00",
    wholesalePrice: "4400.00", sku: "SG-BAT-EW", baseUom: "Piece", packageType: "Piece",
    salesDesc: "SG English Willow Cricket Bat", purchaseDesc: "SG Cricket Bat — case of 6", preferredSupplier: "Direct from Brand",
  },
};

export type IndustryKey = keyof typeof SETS;

export function industryKeyFor(industry: string): IndustryKey {
  const s = (industry || "").toLowerCase();
  if (s.includes("pharma") || s.includes("medical")) return "pharmacy";
  if (s.includes("textile") || s.includes("garment") || s.includes("apparel")) return "textile";
  if (s.includes("footwear") || s.includes("shoe")) return "footwear";
  if (s.includes("electronic") || s.includes("mobile")) return "electronics";
  if (s.includes("furnitur")) return "furniture";
  if (s.includes("hardware") || s.includes("building") || s.includes("paint")) return "hardware";
  if (s.includes("cosmetic") || s.includes("personal care") || s.includes("beauty")) return "cosmetics";
  if (s.includes("automobile") || s.includes("spare") || s.includes("auto")) return "automobile";
  if (s.includes("stationery") || s.includes("book")) return "stationery";
  if (s.includes("sport") || s.includes("fitness")) return "sports";
  return "grocery";
}

export function industrySamplesFor(industry: string): SampleSet {
  return SETS[industryKeyFor(industry)] ?? SETS.grocery;
}

export const INDUSTRY_LABEL: Record<IndustryKey, string> = {
  grocery: "Grocery", pharmacy: "Pharmacy", textile: "Textile", footwear: "Footwear",
  electronics: "Electronics", furniture: "Furniture", hardware: "Hardware",
  cosmetics: "Cosmetics", automobile: "Automobile", stationery: "Stationery", sports: "Sports",
};

/* --------------------- AI classification from product name --------------- */

export interface Classification {
  category: string;
  subCategory: string;
  group: string;
  family: string;
  segment: string;
}

// Keyword → refined classification, evaluated against the product name within
// the active industry. The industry's default set is the fallback.
const CLASSIFY_RULES: Partial<Record<IndustryKey, { kw: RegExp; subCategory: string; group?: string; family?: string }[]>> = {
  textile: [
    { kw: /t-?shirt|tee\b|polo/, subCategory: "T-Shirts", group: "Apparel", family: "Casual Wear" },
    { kw: /shirt|formal/, subCategory: "Shirts", group: "Apparel", family: "Formal Wear" },
    { kw: /jean|denim/, subCategory: "Jeans", group: "Apparel", family: "Bottom Wear" },
    { kw: /trouser|pant|chino|short/, subCategory: "Trousers", group: "Apparel", family: "Bottom Wear" },
    { kw: /kurta|ethnic|saree|salwar|lehenga/, subCategory: "Ethnic Wear", group: "Apparel", family: "Ethnic" },
    { kw: /jacket|sweater|hoodie|sweatshirt/, subCategory: "Winter Wear", group: "Apparel", family: "Winter Wear" },
  ],
  footwear: [
    { kw: /running|sport|sneaker|train/, subCategory: "Sports Shoes", group: "Apparel", family: "Running" },
    { kw: /formal|leather|oxford|derby/, subCategory: "Formal Shoes", group: "Apparel", family: "Formal" },
    { kw: /sandal|slipper|floater|flip/, subCategory: "Sandals", group: "Apparel", family: "Casual" },
    { kw: /boot/, subCategory: "Boots", group: "Apparel", family: "Outdoor" },
  ],
  electronics: [
    { kw: /charger|adapter|cable|power\s?bank/, subCategory: "Mobile Accessories", group: "Durables", family: "Accessories" },
    { kw: /phone|mobile|smartphone/, subCategory: "Mobiles", group: "Durables", family: "Smartphones" },
    { kw: /headphone|earphone|earbud|buds|speaker|audio/, subCategory: "Audio", group: "Durables", family: "Audio Devices" },
    { kw: /laptop|notebook|macbook/, subCategory: "Computers", group: "Durables", family: "Laptops" },
    { kw: /\btv\b|television|monitor/, subCategory: "Television", group: "Durables", family: "Displays" },
  ],
  pharmacy: [
    { kw: /tablet|\btab\b/, subCategory: "Tablets", group: "Consumables", family: "Oral" },
    { kw: /syrup|suspension|drops/, subCategory: "Syrups", group: "Consumables", family: "Liquid" },
    { kw: /capsule|\bcap\b/, subCategory: "Capsules", group: "Consumables", family: "Oral" },
    { kw: /injection|vial|\binj\b|ampoule/, subCategory: "Injectables", group: "Consumables", family: "Parenteral" },
    { kw: /cream|ointment|\bgel\b|lotion/, subCategory: "Topical", group: "Consumables", family: "External" },
  ],
  grocery: [
    { kw: /biscuit|cookie|namkeen|chips|snack/, subCategory: "Biscuits & Snacks", group: "FMCG", family: "Snacks" },
    { kw: /oil|ghee|vanaspati/, subCategory: "Edible Oils", group: "FMCG", family: "Cooking" },
    { kw: /rice|wheat|atta|flour|dal|pulse|sugar|salt/, subCategory: "Staples", group: "FMCG", family: "Grains & Staples" },
    { kw: /tea|coffee|juice|drink|beverage/, subCategory: "Beverages", group: "FMCG", family: "Beverages" },
    { kw: /soap|shampoo|detergent|cleaner|wash/, subCategory: "Home & Personal Care", group: "FMCG", family: "Care" },
  ],
  cosmetics: [
    { kw: /lipstick|lip\b|gloss/, subCategory: "Lip Makeup", group: "FMCG", family: "Lip Care" },
    { kw: /foundation|compact|concealer|kajal|liner|mascara/, subCategory: "Face Makeup", group: "FMCG", family: "Face" },
    { kw: /cream|serum|moisturis|lotion|sunscreen/, subCategory: "Skincare", group: "FMCG", family: "Skin Care" },
    { kw: /perfume|deo|fragrance/, subCategory: "Fragrances", group: "FMCG", family: "Fragrance" },
  ],
};

/** Lightweight "AI" — suggest Category / Sub-category / Group / Family / Segment
 * from the product name within the active industry. */
export function aiClassify(name: string, ik: IndustryKey): Classification {
  const base = SETS[ik] ?? SETS.grocery;
  const out: Classification = {
    category: base.category, subCategory: base.subCategory, group: base.group,
    family: base.family, segment: base.segment,
  };
  const lower = (name || "").toLowerCase();
  const rule = (CLASSIFY_RULES[ik] ?? []).find((r) => r.kw.test(lower));
  if (rule) {
    out.subCategory = rule.subCategory;
    if (rule.group) out.group = rule.group;
    if (rule.family) out.family = rule.family;
  }
  return out;
}

/* ----------------- industry default variant attribute presets ------------ */

export interface AttrPreset { name: string; type: string; values: string }

export const ATTRIBUTE_PRESETS: Record<IndustryKey, AttrPreset[]> = {
  textile: [
    { name: "Size", type: "Dropdown", values: "XS, S, M, L, XL, XXL" },
    { name: "Size (Numeric)", type: "Dropdown", values: "38, 40, 42, 44, 46" },
    { name: "Colour", type: "Color", values: "Black, White, Navy, Grey, Red" },
    { name: "Fabric", type: "Dropdown", values: "Cotton, Linen, Polyester, Blended" },
  ],
  footwear: [
    { name: "Size (UK)", type: "Dropdown", values: "6, 7, 8, 9, 10, 11" },
    { name: "Colour", type: "Color", values: "Black, Brown, White, Tan" },
    { name: "Width", type: "Dropdown", values: "Narrow, Regular, Wide" },
  ],
  electronics: [
    { name: "Storage", type: "Dropdown", values: "64GB, 128GB, 256GB, 512GB" },
    { name: "RAM", type: "Dropdown", values: "4GB, 6GB, 8GB, 12GB" },
    { name: "Colour", type: "Color", values: "Black, Silver, Blue, Gold" },
  ],
  pharmacy: [
    { name: "Strength", type: "Dropdown", values: "250mg, 500mg, 650mg" },
    { name: "Pack", type: "Dropdown", values: "10 Tablets, 15 Tablets, 1x10" },
  ],
  grocery: [
    { name: "Pack Size", type: "Dropdown", values: "100g, 250g, 500g, 1kg" },
    { name: "Flavour", type: "Dropdown", values: "Original, Masala, Cream & Onion" },
  ],
  cosmetics: [
    { name: "Shade", type: "Color", values: "Nude, Pink, Red, Maroon, Coral" },
    { name: "Size", type: "Dropdown", values: "Mini, Regular, Jumbo" },
  ],
  furniture: [
    { name: "Material", type: "Dropdown", values: "Wood, Metal, Plastic, Glass" },
    { name: "Colour", type: "Color", values: "Brown, Black, White, Walnut" },
    { name: "Size", type: "Dropdown", values: "Single, Double, Queen, King" },
  ],
  hardware: [
    { name: "Size", type: "Dropdown", values: "Small, Medium, Large" },
    { name: "Finish", type: "Dropdown", values: "Matte, Glossy, Satin" },
    { name: "Colour", type: "Color", values: "White, Black, Grey" },
  ],
  automobile: [
    { name: "Variant", type: "Dropdown", values: "Petrol, Diesel" },
    { name: "Pack", type: "Dropdown", values: "Single, Set of 2, Set of 4" },
  ],
  stationery: [
    { name: "Size", type: "Dropdown", values: "A4, A5, A6" },
    { name: "Pack", type: "Dropdown", values: "Single, Pack of 6, Pack of 12" },
    { name: "Colour", type: "Color", values: "Blue, Black, Red, Green" },
  ],
  sports: [
    { name: "Size", type: "Dropdown", values: "S, M, L, XL" },
    { name: "Colour", type: "Color", values: "Blue, Red, Green, Yellow" },
  ],
};

/* -------------------- industry-aware AI setup tips (right rail) ----------- */

export const AI_TIPS: Record<IndustryKey, string[]> = {
  textile: ["Add Size & Colour attributes — each combination becomes its own SKU", "Apparel is 5% GST below ₹1000, 12% above", "Shirts → HSN 6205, T-shirts → 6109"],
  footwear: ["Use a numeric UK Size attribute (6–11)", "Footwear is 12% GST below ₹1000, else 18%", "Footwear → HSN 6403 / 6404"],
  electronics: ["Turn on Serial Number tracking for warranty claims", "Add Storage / RAM / Colour variants", "Most electronics are 18% GST"],
  pharmacy: ["Enable Batch & Expiry tracking — mandatory for drugs", "Schedule H / H1 drugs need prescription control", "Medicines are 5–12% GST, HSN 3004"],
  grocery: ["Enable Expiry tracking for perishables", "Add Pack Size variants (100g, 500g, 1kg)", "Staples 0–5%, packaged 12–18% GST"],
  cosmetics: ["Add Shade & Size variants", "Cosmetics are 18% GST, HSN 3304", "Track Expiry for shelf life"],
  furniture: ["Add Material & Colour variants", "Furniture is 18% GST, HSN 9401 / 9403", "Capture package dimensions for freight"],
  hardware: ["Track paints & chemicals by Batch", "Most hardware is 18% GST", "Use UOM like Litre / Kg / Piece"],
  automobile: ["Enable Serial / Part Number tracking", "Spares are mostly 18–28% GST", "Map to vehicle make & model"],
  stationery: ["Add Size & Pack variants", "Stationery is 12% GST, HSN 4820", "Sell bundles as a separate UOM"],
  sports: ["Add Size & Colour variants", "Sports goods are 12% GST, HSN 9506", "Group by sport / discipline"],
};

/* ----------------------------- AI generators ----------------------------- */

const KEYWORD_FLAVOR: Record<IndustryKey, string[]> = {
  grocery: ["daily needs", "kirana", "snack"], pharmacy: ["medicine", "otc", "healthcare"],
  textile: ["clothing", "fashion", "wear"], footwear: ["footwear", "shoes", "sports"],
  electronics: ["gadget", "accessory", "electronics"], furniture: ["home", "furniture", "decor"],
  hardware: ["building material", "hardware", "tools"], cosmetics: ["beauty", "makeup", "skincare"],
  automobile: ["spare parts", "automotive", "vehicle"], stationery: ["school", "office", "stationery"],
  sports: ["sports", "fitness", "outdoor"],
};
const DESC_FLAVOR: Record<IndustryKey, string> = {
  grocery: "Everyday essential — quality assured and value priced.",
  pharmacy: "For symptomatic relief; store as directed and check expiry before use.",
  textile: "Comfortable fit with premium fabric and durable stitching.",
  footwear: "Lightweight, durable and built for everyday comfort.",
  electronics: "Reliable performance with manufacturer warranty.",
  furniture: "Sturdy build with a clean, modern finish.",
  hardware: "Professional-grade quality for lasting results.",
  cosmetics: "Skin-friendly formulation, long-lasting and dermatologically tested.",
  automobile: "Precision-engineered OEM-grade spare for a perfect fit.",
  stationery: "Smooth, durable and ideal for school & office use.",
  sports: "Performance gear designed for serious players.",
};

const STOP = new Set(["the", "and", "for", "with", "set", "of", "pack", "pcs", "pc", "new"]);

/** Generate search keywords from the product name (+ category/brand & industry). */
export function aiKeywords(name: string, category: string, brand: string, ik: IndustryKey): string {
  const out = new Set<string>();
  name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).forEach((t) => {
    if (t.length > 1 && !STOP.has(t) && !/^\d+(ml|g|kg|l|mg)?$/.test(t)) out.add(t);
  });
  if (brand) out.add(brand.toLowerCase());
  if (category) out.add(category.toLowerCase());
  KEYWORD_FLAVOR[ik].forEach((k) => out.add(k));
  return Array.from(out).slice(0, 10).join(", ");
}

/** Generate a product description from the product name (+ category/brand & industry). */
export function aiDescription(name: string, category: string, brand: string, ik: IndustryKey): string {
  const cat = (category || SETS[ik].category).toLowerCase();
  const brandPart = brand ? ` from ${brand}` : "";
  return `${name} — a ${cat} product${brandPart}. ${DESC_FLAVOR[ik]}`;
}
