"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { buildTokenSlipHtml, type TokenSlipData } from "@/lib/print/tokenSlipHtml";
import { DEFAULT_RECEIPT } from "@/lib/settings/receiptTemplate";

const stripAutoPrint = (html: string) => html.replace(/<script>window\.onload[\s\S]*?<\/script>/, "");
// buildTokenSlipHtml returns a standalone <!doctype html> document (style in
// <head>, markup in <body>) meant for a popup window — pull both pieces back
// out so they can be dropped straight into this page instead.
function extractDocParts(html: string): { style: string; body: string } {
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? html;
  return { style, body };
}

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
  const toast = useToast();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const gateEntryId = searchParams.get("gateEntryId");
  const next = searchParams.get("next") || "/transport/pre-weighment";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<TokenSlipData | null>(null);
  const [tpl, setTpl] = useState({ title: DEFAULT_RECEIPT.title, footerNote: DEFAULT_RECEIPT.footerNote });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const q = id ? `id=${id}` : `gateEntryId=${gateEntryId}`;
        const [dataRes, tplRes] = await Promise.all([
          fetch(`/api/transport/pre-weighment/print-data?${q}`, { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/settings/invoice-template?type=TOKEN", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!active) return;
        if (!dataRes?.ok) { setNotFound(true); return; }
        setData(dataRes.tokenSlip);
        if (tplRes?.ok) setTpl({ title: tplRes.template.title, footerNote: tplRes.template.footerNote });
      } catch { if (active) setNotFound(true); } finally { if (active) setLoading(false); }
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

  const { style: slipStyle, body: slipBody } = data
    ? extractDocParts(stripAutoPrint(buildTokenSlipHtml(data, tpl)))
    : { style: "", body: "" };
  // The generated document's CSS targets `body{…}` (it's meant to BE the whole
  // popup document) — retarget that to the wrapper div this page actually uses.
  const scopedSlipStyle = slipStyle.replace("body{", ".token-slip-root{");

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

      {!loading && notFound && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm print:hidden">
          <Scale className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">Could not load this token.</p>
          <p className="mt-1 text-sm text-muted">The Pre-Loading Weighment may not exist, or you don&apos;t have access to it.</p>
        </div>
      )}

      {!loading && data && (
        <div id="token-print-area" className="flex justify-center rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <style>{scopedSlipStyle}</style>
          <div className="token-slip-root w-full max-w-[360px]" dangerouslySetInnerHTML={{ __html: slipBody }} />
        </div>
      )}
    </div>
  );
}
