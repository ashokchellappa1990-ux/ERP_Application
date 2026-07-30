import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { FundTransferTab } from "@/components/operations/tabs/FundTransferTab";

// Finance → Cash Management → Fund Transfer. Reuses the exact day open/close
// fund-transfer feature (same form, banks/terminals/safe integration + submit).
export default function FinanceFundTransferPage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span>
          <Link href="/finance/cash" className="hover:text-foreground">Fund Management</Link><span className="text-subtle">/</span>
          <span className="font-medium text-foreground">Fund Transfer</span>
        </div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ArrowLeftRight className="h-5 w-5 text-primary" /> New Fund Transfer</h1>
        <p className="mt-0.5 text-sm text-muted">Move cash between bank, safe locker and terminals. Recorded transfers appear in the Cash Management list.</p>
      </div>
      <FundTransferTab />
    </div>
  );
}
