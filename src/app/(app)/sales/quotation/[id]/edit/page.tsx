import { SalesDocEditor } from "@/components/sales/SalesDocEditor";
export default function Page({ params }: { params: { id: string } }) { return <SalesDocEditor docType="quotation" docId={Number(params.id)} />; }
