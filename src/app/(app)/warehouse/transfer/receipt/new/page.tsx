import { ReceiptEditor } from "@/components/warehouse/receipt/ReceiptEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "New Receipt" };
export default function Page({ searchParams }: { searchParams: { dispatchId?: string } }) {
  return <ReceiptEditor dispatchId={searchParams.dispatchId ? Number(searchParams.dispatchId) : undefined} />;
}
