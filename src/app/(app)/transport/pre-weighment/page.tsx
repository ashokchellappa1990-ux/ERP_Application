import { WeighmentQueueList } from "@/components/transport/WeighmentQueueList";
export const dynamic = "force-dynamic";
export const metadata = { title: "First Weighment" };
export default function Page() { return <WeighmentQueueList stage="first" />; }
