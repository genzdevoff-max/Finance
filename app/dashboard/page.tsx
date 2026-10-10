import { Suspense } from 'react';
import { getDashboardSummary } from '@/lib/services/dashboard.service';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { CollectionsPeriodTabs } from '@/components/dashboard/CollectionsPeriodTabs';
import { OutstandingPeopleList } from '@/components/dashboard/OutstandingPeopleList';
import { Header } from '@/components/shared/Header';
import { Skeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function DashboardContent() {
  let summary = null;
  let errorMsg: string | null = null;

  try {
    summary = await getDashboardSummary();
  } catch (err: unknown) {
    console.error('Failed to load dashboard data:', err);
    errorMsg = err instanceof Error ? err.message : 'Unable to load dashboard data.';
  }

  return (
    <div className="p-4 space-y-6">
      {errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900 shadow-sm space-y-2">
          <h3 className="font-bold text-base">Error Loading Data</h3>
          <p className="text-sm leading-relaxed">{errorMsg}</p>
        </div>
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
    <div className="p-4 space-y-6" aria-label="Loading dashboard" role="status">
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

export default function DashboardPage() {
  const todayFormatted = format(new Date(), 'EEEE, dd MMMM');

  return (
    <div>
      <Header
        title="Finance Tracker"
        subtitle={todayFormatted}
      />
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
