"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProductFormProvider, type ProductFormData } from "@/components/masters/ProductFormContext";
import { ProductEditor } from "@/components/masters/ProductEditor";
import { AppLoader } from "@/components/ui/AppLoader";

export default function EditProductPage() {
  const params = useParams();
  const id = Number(params.id);
  const [initial, setInitial] = useState<Partial<ProductFormData> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && j.data) setInitial(j.data);
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
  if (!initial) return <AppLoader label="Loading product…" />;

  return (
    <ProductFormProvider initial={initial}>
      <ProductEditor productId={id} />
    </ProductFormProvider>
  );
}
