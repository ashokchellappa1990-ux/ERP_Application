import { MaintenanceScheduleForm } from "@/components/transport/masters/MaintenanceScheduleForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Maintenance Schedule" };
export default function Page() { return <MaintenanceScheduleForm mode="edit" />; }
