import { BudgetEditor } from "@/components/finance/BudgetEditor";

export default function BudgetDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { mode?: string } }) {
  return <BudgetEditor headerId={Number(params.id)} forceView={searchParams.mode === "view"} />;
}
