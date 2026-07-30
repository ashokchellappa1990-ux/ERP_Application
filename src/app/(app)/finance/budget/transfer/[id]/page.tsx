import { TransferForm } from "@/components/finance/TransferForm";
export default function Page({ params }: { params: { id: string } }) { return <TransferForm mode="view" id={Number(params.id)} />; }
