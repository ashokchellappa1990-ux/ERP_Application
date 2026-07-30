import { SalesDocList } from "@/components/sales/SalesDocList";
export const metadata = { title: "Sales Order · Oasys Orbit" };
export default function Page() { return <SalesDocList docType="order" />; }
