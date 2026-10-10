import { Suspense } from 'react';
import { AddCollectionForm, type PersonWithLoansData } from '@/components/collections/AddCollectionForm';
import { Header } from '@/components/shared/Header';
import { Skeleton } from '@/components/ui/Skeleton';
import { getPeopleWithActiveLoansForCollection } from '@/lib/services/loans.service';

export const dynamic = 'force-dynamic';

interface NewCollectionPageProps {
  searchParams: Promise<{
    personId?: string;
    loanId?: string;
  }>;
}

async function CollectionFormData({ searchParams }: NewCollectionPageProps) {
  const { personId, loanId } = await searchParams;
  const peopleWithLoans: PersonWithLoansData[] =
    await getPeopleWithActiveLoansForCollection();

  return (
    <div className="p-4">
      <AddCollectionForm
        people={peopleWithLoans}
        initialPersonId={personId}
        initialLoanId={loanId}
      />
    </div>
  );
}

export default function NewCollectionPage(props: NewCollectionPageProps) {
  return (
    <div>
      <Header
        title="Add Collection"
        subtitle="Quick repayment entry"
        backHref="/dashboard"
      />
      <Suspense
        fallback={
          <div className="p-4" aria-label="Loading collection form" role="status">
            <Skeleton className="h-[32rem] w-full rounded-2xl" />
          </div>
        }
      >
        <CollectionFormData searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
