import { getDashboardSummary } from '@/lib/services/dashboard.service';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { CollectionsPeriodTabs } from '@/components/dashboard/CollectionsPeriodTabs';
import { OutstandingPeopleList } from '@/components/dashboard/OutstandingPeopleList';
import { Header } from '@/components/shared/Header';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let summary = null;
  let errorMsg: string | null = null;

  try {
    summary = await getDashboardSummary();
  } catch (err: unknown) {
    console.error('Failed to load dashboard data:', err);
    errorMsg = err instanceof Error ? err.message : 'Unable to load dashboard data.';
  }

  const todayFormatted = format(new Date(), 'EEEE, dd MMMM');

  return (
    <div>
      <Header
        title="Finance Tracker"
        subtitle={todayFormatted}
      />

      <div className="p-4 space-y-6">
        {errorMsg ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900 shadow-sm space-y-2">
            <h3 className="font-bold text-base">Error Loading Data</h3>
            <p className="text-sm leading-relaxed">{errorMsg}</p>
          </div>
        ) : summary ? (
          <>
            {/* Main Financial Metrics */}
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

            {/* Outstanding People */}
            <OutstandingPeopleList people={summary.outstandingPeople} />
          </>
        ) : null}
      </div>
    </div>
  );
}
