import { notFound } from 'next/navigation';
import { getCollectionById } from '@/lib/services/collections.service';
import { getLoanById } from '@/lib/services/loans.service';
import { EditCollectionForm } from '@/components/collections/EditCollectionForm';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface EditCollectionPageProps {
  params: Promise<{
    collectionId: string;
  }>;
}

export default async function EditCollectionPage({ params }: EditCollectionPageProps) {
  const { collectionId } = await params;
  const collection = await getCollectionById(collectionId);

  if (!collection) {
    notFound();
  }

  const loan = await getLoanById(collection.loanId);
  if (!loan) {
    notFound();
  }

  const maxAllowedPaise = loan.loanAmount - loan.totalCollected + collection.amount;

  return (
    <div>
      <Header
        title="Edit Collection"
        subtitle={`Correction for ${collection.personName}`}
        backHref={`/loans/${collection.loanId}`}
      />

      <div className="p-4">
        <EditCollectionForm
          collection={collection}
          maxAllowedPaise={maxAllowedPaise}
        />
      </div>
    </div>
  );
}
