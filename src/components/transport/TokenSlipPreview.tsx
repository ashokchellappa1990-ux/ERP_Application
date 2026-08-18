"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { buildTokenSlipParts, type TokenSlipData } from "@/lib/print/tokenSlipHtml";
import { DEFAULT_RECEIPT } from "@/lib/settings/receiptTemplate";

/** In-app preview of the Pre Load Weight Slip (Token) — reached either right
 * after submitting a Pre-Loading Weighment ("Preview & Print"), from the
 * weighment list, or from a Load & Dispatch view's "Print Token" button.
 * Unlike every other document in this app (which prints via a window.open
 * popup that auto-fires window.print()), this shows the slip inline on its
 * own page first and only sends it to the printer when Print is explicitly
 * clicked — the popup+auto-print pattern doesn't give the user a chance to
 * actually look at it first. */
export function TokenSlipPreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const gateEntryId = searchParams.get("gateEntryId");
  const next = searchParams.get("next") || "/transport/pre-weighment";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<TokenSlipData | null>(null);
  const [tpl, setTpl] = useState({
    title: DEFAULT_RECEIPT.title, footerNote: DEFAULT_RECEIPT.footerNote, tokenCodeType: DEFAULT_RECEIPT.tokenCodeType,
    tokenBrandFontSize: DEFAULT_RECEIPT.tokenBrandFontSize, tokenBoldValues: DEFAULT_RECEIPT.tokenBoldValues,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      if (!id && !gateEntryId) { setErrorMsg("No weighment or gate entry was specified."); setLoading(false); return; }
      try {
        const q = id ? `id=${id}` : `gateEntryId=${gateEntryId}`;
        const [dataRes, tplRes] = await Promise.all([
          fetch(`/api/transport/pre-weighment/print-data?${q}`, { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/settings/invoice-template?type=TOKEN", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!active) return;
        if (!dataRes?.ok) { setErrorMsg(dataRes?.message || "Could not load this token."); return; }
        setData(dataRes.tokenSlip);
        if (tplRes?.ok) setTpl({
          title: tplRes.template.title, footerNote: tplRes.template.footerNote,
          tokenCodeType: tplRes.template.tokenCodeType === "barcode" ? "barcode" : "qrcode",
          tokenBrandFontSize: ["large", "xlarge"].includes(tplRes.template.tokenBrandFontSize) ? tplRes.template.tokenBrandFontSize : "normal",
          tokenBoldValues: !!tplRes.template.tokenBoldValues,
        });
      } catch (err) {
        console.error("[TokenSlipPreview] load error", err);
        if (active) setErrorMsg("Network error — could not load this token.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, gateEntryId]);

  // Redirect once the print dialog closes (printed OR cancelled) — "afterprint"
  // is the standard event for this; fires whether or not the user actually
  // printed, matching "after printing is done, move on" rather than only
  // succeeding on a completed print.
  useEffect(() => {
    const onAfterPrint = () => router.push(next);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [next, router]);

  function handlePrint() {
    if (!data) return;
    window.print();
  }

  const { style: slipStyle, bodyHtml: slipBody } = data ? buildTokenSlipParts(data, tpl, window.location.origin) : { style: "", bodyHtml: "" };

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #token-print-area, #token-print-area * { visibility: visible; }
          #token-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Pre Loading Weighment</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Pre Load Weight Slip</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Pre Load Weight Slip Preview</h1>
          <p className="mt-0.5 text-sm text-muted">Review the token below, then print it — you'll return to the list once printing is done.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={() => router.push(next)}><ArrowLeft className="h-4 w-4" /> Back</Button>
          <Button size="md" onClick={handlePrint} disabled={!data}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      {loading && <AppLoader label="Loading token details…" />}

      {!loading && errorMsg && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm print:hidden">
          <Scale className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">{errorMsg}</p>
          <p className="mt-1 text-sm text-muted">The Pre-Loading Weighment may not exist, or you don&apos;t have access to it.</p>
        </div>
      )}

      {!loading && data && (
        <div id="token-print-area" className="flex justify-center rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <style>{slipStyle}</style>
          <div className="w-full max-w-[360px]" dangerouslySetInnerHTML={{ __html: slipBody }} />
        </div>
      )}
    </div>
  );
}
