import { SalesDocView } from "@/components/sales/SalesDocView";
export default function Page({ params }: { params: { id: string } }) { return <SalesDocView docType="quotation" id={Number(params.id)} />; }
