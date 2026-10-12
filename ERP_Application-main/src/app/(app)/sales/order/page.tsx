import { SalesDocList } from "@/components/sales/SalesDocList";
export const metadata = { title: "Sales Order" };
export default function Page() { return <SalesDocList docType="order" />; }
