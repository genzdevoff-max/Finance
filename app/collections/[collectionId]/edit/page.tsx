import { notFound } from 'next/navigation';
import { getCollectionById } from '@/lib/services/collections.service';
import { db } from '@/lib/db';
import { collections, loans } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
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

  // Calculate maximum allowed amount for this loan
  const [loanRecord] = await db
    .select()
    .from(loans)
    .where(eq(loans.id, collection.loanId));

  if (!loanRecord) {
    notFound();
  }

  const otherSum = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
    })
    .from(collections)
    .where(
      and(
        eq(collections.loanId, collection.loanId),
        sql`${collections.id} != ${collectionId}`
      )
    );

  const otherCollected = Number(otherSum[0]?.total ?? 0);
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
