import { notFound } from 'next/navigation';
import { getCollectionById } from '@/lib/services/collections.service';
import { readLocalDb } from '@/lib/storage/local-store';
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

  const local = readLocalDb();
  const loanRecord = local.loans.find((l) => l.id === collection.loanId);

  if (!loanRecord) {
    notFound();
  }

  const otherCollected = local.collections
    .filter((c) => c.loanId === collection.loanId && c.id !== collectionId)
    .reduce((sum, c) => sum + c.amount, 0);

  const maxAllowedPaise = Math.max(0, loanRecord.loanAmount - otherCollected);

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
