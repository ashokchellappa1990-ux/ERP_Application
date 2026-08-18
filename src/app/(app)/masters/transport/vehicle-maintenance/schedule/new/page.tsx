import { MaintenanceScheduleForm } from "@/components/transport/masters/MaintenanceScheduleForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "New Maintenance Schedule" };
export default function Page() { return <MaintenanceScheduleForm mode="new" />; }
