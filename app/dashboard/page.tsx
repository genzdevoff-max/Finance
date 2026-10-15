import { Suspense } from 'react';
import { getDashboardSummary } from '@/lib/services/dashboard.service';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { CollectionsPeriodTabs } from '@/components/dashboard/CollectionsPeriodTabs';
import { OutstandingPeopleList } from '@/components/dashboard/OutstandingPeopleList';
import { IndividualDashboard } from '@/components/dashboard/IndividualDashboard';
import { PersonDashboardSelector } from '@/components/dashboard/PersonDashboardSelector';
import { getPersonById } from '@/lib/services/people.service';
import { Header } from '@/components/shared/Header';
import { Skeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function DashboardContent({
  personId,
  loanPage,
}: {
  personId?: string;
  loanPage: number;
}) {
  let summary = null;
  let person = null;
  let errorMsg: string | null = null;

  try {
    if (personId) {
      person = await getPersonById(personId, loanPage);
      if (!person) errorMsg = 'The selected person could not be found.';
    } else {
      summary = await getDashboardSummary();
    }
  } catch (err: unknown) {
    console.error('Failed to load dashboard data:', err);
    errorMsg = err instanceof Error ? err.message : 'Unable to load dashboard data.';
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:space-y-5 sm:p-6 lg:p-8">
      <PersonDashboardSelector
        selectedPerson={
          person ? { id: person.id, fullName: person.fullName, phone: person.phone } : null
        }
      />
      {errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900 shadow-sm space-y-2">
          <h3 className="font-bold text-base">Error Loading Data</h3>
          <p className="text-sm leading-relaxed">{errorMsg}</p>
        </div>
      ) : person ? (
        <IndividualDashboard person={person} />
      ) : summary ? (
        <>
          <DashboardMetrics summary={summary} />
          <CollectionsPeriodTabs
            today={{
              totalCollected: summary.todayCollections.totalCollectedToday,
              count: summary.todayCollections.count,
              items: summary.todayCollections.items,
            }}
            week={summary.weekCollections}
            month={summary.monthCollections}
          />
          <OutstandingPeopleList people={summary.outstandingPeople} />
        </>
      ) : null}
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:space-y-5 sm:p-6 lg:p-8" aria-label="Loading dashboard" role="status">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

interface DashboardPageProps {
  searchParams: Promise<{ personId?: string; loanPage?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { personId, loanPage: requestedLoanPage } = await searchParams;
  const parsedLoanPage = Number(requestedLoanPage);
  const loanPage =
    Number.isSafeInteger(parsedLoanPage) && parsedLoanPage > 0 ? parsedLoanPage : 1;
  const todayFormatted = format(new Date(), 'EEEE, dd MMMM');

  return (
    <div>
      <Header
        title="Finance Tracker"
        subtitle={todayFormatted}
      />
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent personId={personId} loanPage={loanPage} />
      </Suspense>
    </div>
  );
}
