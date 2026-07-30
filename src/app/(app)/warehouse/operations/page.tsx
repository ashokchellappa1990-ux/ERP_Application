import { WarehouseStub } from "@/components/warehouse/WarehouseStub";
export const dynamic = "force-dynamic";
export const metadata = { title: "Warehouse Operations · Oasys Orbit" };
export default function Page() { return <WarehouseStub title="Warehouse Operations" note="Put-away, picking, packing, dispatch and internal transfers driven by each warehouse's configuration. For now use the Inventory module (GRN, Stock Transfer, Put-Away)." />; }
