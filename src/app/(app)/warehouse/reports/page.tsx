import { WarehouseStub } from "@/components/warehouse/WarehouseStub";
export const dynamic = "force-dynamic";
export const metadata = { title: "Warehouse Reports · Oasys Orbit" };
export default function Page() { return <WarehouseStub title="Warehouse Reports" note="Warehouse-wise stock, capacity, ageing, movement and configuration reports will appear here." />; }
