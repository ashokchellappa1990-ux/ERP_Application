import { FinanceVoucherForm } from "@/components/finance/FinanceVoucherForm";

export default function NewAccountPage() {
  return <FinanceVoucherForm featureKey="coa" backHref="/accounting/chart-of-accounts" />;
}
