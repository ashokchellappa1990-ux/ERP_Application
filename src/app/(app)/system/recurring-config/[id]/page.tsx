import { RecurringConfigForm } from "@/components/finance/RecurringConfigForm";
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { mode?: string } }) {
  return <RecurringConfigForm id={Number(params.id)} mode={searchParams.mode === "view" ? "view" : "edit"} />;
}
