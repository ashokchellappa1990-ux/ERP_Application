import { CustomerCollectionView } from "@/components/sales/CustomerCollectionView";

export default function CollectionViewPage({ params }: { params: { id: string } }) {
  return <CustomerCollectionView id={Number(params.id)} />;
}
