import { PurchaseOrderView } from "@/components/purchase/PurchaseOrderView";
export const metadata = { title: "Purchase Order · Oasys Orbit" };
export default function Page({ params }: { params: { id: string } }) { return <PurchaseOrderView id={Number(params.id)} />; }
