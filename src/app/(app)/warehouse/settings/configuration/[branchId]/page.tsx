import { WarehouseConfigEditor } from "@/components/warehouse/WarehouseConfigEditor";
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { branchId: string } }) { return <WarehouseConfigEditor branchId={Number(params.branchId)} />; }
