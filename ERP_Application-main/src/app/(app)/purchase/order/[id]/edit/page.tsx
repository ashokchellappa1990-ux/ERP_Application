import { PurchaseOrderEditor } from "@/components/purchase/PurchaseOrderEditor";
export const metadata = { title: "Edit Purchase Order" };
export default function Page({ params }: { params: { id: string } }) { return <PurchaseOrderEditor orderId={Number(params.id)} />; }
