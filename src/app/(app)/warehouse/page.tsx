import { WarehouseStub } from "@/components/warehouse/WarehouseStub";
export const dynamic = "force-dynamic";
export const metadata = { title: "Warehouse Dashboard" };
export default function Page() { return <WarehouseStub title="Warehouse Dashboard" note="Warehouse KPIs, capacity utilisation, receiving/dispatch throughput and configuration health will appear here. Configure warehouses under Warehouse Configuration." />; }
