import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehicle Loading" };

// Safety net for OLD Pre Load Weight Slips printed before the QR switched
// to an opaque per-entry token (?gateEntryNo=... query string, no [token]
// path segment) — without this literal page, that URL falls through to the
// authenticated app's catch-all "Coming Soon" placeholder
// (src/app/(app)/[...slug]/page.tsx), which is confusing on a public,
// no-login scan and shows the full app shell to whoever scanned it.
// gateEntryNo alone can't be safely resolved here (only unique per-tenant,
// not a valid public lookup key) — this only ever shows a static message.
export default function LegacyTokenLinkPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
        <h1 className="text-lg font-bold text-foreground">This link has expired</h1>
        <p className="text-sm text-muted">This Pre Load Weight Slip was printed before this page existed. Please ask the gate office for a reprinted slip — its QR code will open this page directly.</p>
        <Link href="/" className="inline-block text-sm font-semibold text-primary hover:underline">Go to StoneFlow ERP</Link>
      </div>
    </div>
  );
}
