import { PurchaseOrderView } from "@/components/purchase/PurchaseOrderView";
export const metadata = { title: "Purchase Order" };
export default function Page({ params }: { params: { id: string } }) { return <PurchaseOrderView id={Number(params.id)} />; }
