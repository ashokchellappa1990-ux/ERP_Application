import { ReceiptTabs } from "@/components/warehouse/receipt/ReceiptTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Transfer Receipt · Oasys Orbit" };
export default function Page({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = (["pending", "receipts", "history"].includes(searchParams.tab ?? "") ? searchParams.tab : "pending") as "pending" | "receipts" | "history";
  return <ReceiptTabs initialTab={tab} />;
}
