import { DeliveryChallanView } from "@/components/transport/DeliveryChallanView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery Challan" };
export default function Page({ params }: { params: { id: string } }) { return <DeliveryChallanView id={Number(params.id)} />; }
