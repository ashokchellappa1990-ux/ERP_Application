"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { buildTaxInvoiceParts, type TaxInvoiceData } from "@/lib/print/taxInvoiceHtml";
import { buildTaxInvoiceT3Parts, type TaxInvoiceT3Data } from "@/lib/print/taxInvoiceT3Html";
import { buildWeightSlipParts, type WeightSlipData } from "@/lib/print/weightSlipHtml";
import { DEFAULT_RECEIPT } from "@/lib/settings/receiptTemplate";

type Kind = "dc" | "weight-slip" | "invoice";
const KIND_LABEL: Record<Kind, string> = { dc: "Delivery Challan", "weight-slip": "Weight Slip", invoice: "Tax Invoice" };
const KIND_TPL_TYPE: Record<Kind, string | null> = { dc: null, "weight-slip": "WEIGHT_SLIP", invoice: "B2B_T3" };

/** In-app preview for Load & Dispatch's Delivery Challan / Weight Slip / Tax
 * Invoice — same pattern as the Pre Load Weight Slip (Token) preview: shows
 * the document inline first, only sends it to the printer when Print is
 * explicitly clicked, then returns to the dispatch view once the print
 * dialog closes. Replaces the old window.open-and-auto-print popups for
 * these three documents. */
export function LoadDispatchDocumentPreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const kind = (searchParams.get("kind") as Kind | null) ?? "invoice";
  const next = searchParams.get("next") || (id ? `/warehouse/transfer/load-dispatch/${id}` : "/warehouse/transfer/load-dispatch");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parts, setParts] = useState<{ style: string; bodyHtml: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      if (!id) { setErrorMsg("No dispatch was specified."); setLoading(false); return; }
      try {
        const tplType = KIND_TPL_TYPE[kind];
        const [dataRes, tplRes] = await Promise.all([
          fetch(`/api/warehouse/load-dispatch/${id}/print-data`, { cache: "no-store" }).then((r) => r.json()),
          tplType ? fetch(`/api/settings/invoice-template?type=${tplType}`, { cache: "no-store" }).then((r) => r.json()) : Promise.resolve(null),
        ]);
        if (!active) return;
        if (!dataRes?.ok) { setErrorMsg(dataRes?.message || "Could not load print data."); return; }
        const tpl = tplRes?.ok ? { title: tplRes.template.title, footerNote: tplRes.template.footerNote } : DEFAULT_RECEIPT;

        if (kind === "dc") {
          if (!dataRes.deliveryNote) { setErrorMsg("No Delivery Challan has been generated for this dispatch yet."); return; }
          setParts(buildTaxInvoiceParts(dataRes.deliveryNote as TaxInvoiceData, { title: "Delivery Note", footerNote: DEFAULT_RECEIPT.footerNote }));
        } else if (kind === "weight-slip") {
          if (!dataRes.weightSlip) { setErrorMsg("No Vehicle Gate Entry / weighment is linked to this dispatch."); return; }
          setParts(buildWeightSlipParts(dataRes.weightSlip as WeightSlipData, tpl));
        } else {
          if (!dataRes.taxInvoiceT3) { setErrorMsg("No Sales Invoice has been posted for this dispatch yet."); return; }
          const t3 = dataRes.taxInvoiceT3 as TaxInvoiceT3Data;
          setParts(buildTaxInvoiceT3Parts({ ...t3, qrCodeImage: tplRes?.template?.qrCodeImage || null, signatureImage: tplRes?.template?.signatureImage || null }, tpl));
        }
      } catch (err) {
        console.error("[LoadDispatchDocumentPreview] load error", err);
        if (active) setErrorMsg("Network error — could not load print data.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, kind]);

  // Redirect once the print dialog closes (printed OR cancelled).
  useEffect(() => {
    const onAfterPrint = () => router.push(next);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [next, router]);

  function handlePrint() {
    if (!parts) return;
    window.print();
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #doc-print-area, #doc-print-area * { visibility: visible; }
          #doc-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Load &amp; Dispatch</span><span className="text-subtle">/</span><span className="font-medium text-foreground">{KIND_LABEL[kind]}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileText className="h-5 w-5 text-primary" /> {KIND_LABEL[kind]} Preview</h1>
          <p className="mt-0.5 text-sm text-muted">Review the document below, then print it — you&apos;ll return to the dispatch once printing is done.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={() => router.push(next)}><ArrowLeft className="h-4 w-4" /> Back</Button>
          <Button size="md" onClick={handlePrint} disabled={!parts}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      {loading && <AppLoader label="Loading document…" />}

      {!loading && errorMsg && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm print:hidden">
          <FileText className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">{errorMsg}</p>
        </div>
      )}

      {!loading && parts && (
        <div id="doc-print-area" className="flex justify-center overflow-x-auto rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <style>{parts.style}</style>
          <div className="w-full" dangerouslySetInnerHTML={{ __html: parts.bodyHtml }} />
        </div>
      )}
    </div>
  );
}
