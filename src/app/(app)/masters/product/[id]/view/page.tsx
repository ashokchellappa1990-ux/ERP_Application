"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, Boxes, Tag, Tags, ReceiptText, Layers, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Variant {
  id: string;
  label: string;
  dims: { name: string; value: string }[];
  sku: string;
  barcode: string;
  mrp: string;
  openingStock: string;
  status: string;
}
interface ProductData {
  fields: Record<string, string>;
  attributes: { name: string; type: string; values: string }[];
  variants: Variant[];
}

export default function ProductViewPage() {
  const fmt = useFmt();
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<ProductData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && j.data) setData(j.data);
        else setError(j?.message || "Product not found.");
      } catch {
        if (active) setError("Could not load the product.");
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <div className="py-24 text-center text-sm text-muted">{error}</div>;
  if (!data) return <AppLoader label="Loading product…" />;

  const f = data.fields;
  const g = (k: string) => f[k] || "—";
  const money = (k: string) => (f[k] ? fmt.money(Number(f[k]) || 0) : "—");

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link href="/masters/product" className="hover:text-foreground">Masters</Link>
            <span className="text-subtle">/</span>
            <Link href="/masters/product" className="hover:text-foreground">Products</Link>
            <span className="text-subtle">/</span>
            <span className="font-medium text-foreground">{g("name")}</span>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Boxes className="h-5 w-5 text-primary" /> {g("name")}
            <Badge tone={f.status === "Active" ? "success" : f.status === "Blocked" ? "danger" : "neutral"}>{g("status")}</Badge>
          </h1>
          <p className="mt-0.5 text-sm text-muted">Code: <span className="font-mono">{g("code")}</span></p>
        </div>
        <div className="flex gap-2">
          <Link href="/masters/product"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back to list</Button></Link>
          <Link href={`/masters/product/${id}`}><Button size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card icon={Tag} title="Classification">
          <Row k="Category" v={g("category")} />
          <Row k="Sub-category" v={g("subCategory")} />
          <Row k="Group" v={g("group")} />
          <Row k="Brand" v={g("brand")} />
          <Row k="Manufacturer" v={g("manufacturer")} />
        </Card>
        <Card icon={Tags} title="Pricing">
          <Row k="MRP" v={money("mrp")} />
          <Row k="Retail Price" v={money("retailPrice")} />
          <Row k="Wholesale Price" v={money("wholesalePrice")} />
          <Row k="Purchase Price" v={money("stdPurchasePrice")} />
        </Card>
        <Card icon={ReceiptText} title="Tax">
          <Row k="GST Rate" v={g("gstRate")} />
          <Row k="HSN" v={g("hsn")} />
          <Row k="Tax Preference" v={g("taxPref")} />
        </Card>
        <Card icon={Layers} title="Stock & UOM">
          <Row k="Base UOM" v={g("baseUom")} />
          <Row k="Opening Qty" v={g("openingQty")} />
          <Row k="Reorder Level" v={g("reorderLevel")} />
          <Row k="Min / Max" v={`${g("minStock")} / ${g("maxStock")}`} />
        </Card>
      </div>

      {/* Variants (separate product records) */}
      {data.variants.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-primary" /> Variants — {data.variants.length} stock-keeping units
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-2.5">Variant</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Barcode</th>
                  <th className="px-4 py-2.5 text-right">MRP</th>
                  <th className="px-4 py-2.5 text-right">Opening Stock</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.variants.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{v.dims.map((d) => <Badge key={d.name} tone="neutral">{d.value}</Badge>)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{v.sku || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{v.barcode || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{v.mrp ? fmt.money(Number(v.mrp) || 0) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{fmt.qty(Number(v.openingStock) || 0)}</td>
                    <td className="px-4 py-2.5 text-center"><Badge tone={v.status === "Active" ? "success" : "neutral"}>{v.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(g("description") !== "—" || g("keywords") !== "—") && (
        <Card icon={Boxes} title="Description">
          {g("keywords") !== "—" && <Row k="Keywords" v={g("keywords")} />}
          {g("description") !== "—" && <p className="text-sm text-foreground">{g("description")}</p>}
        </Card>
      )}
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Tag; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="truncate text-right font-medium text-foreground">{v}</span>
    </div>
  );
}
