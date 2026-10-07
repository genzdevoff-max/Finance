import { getDashboardSummary } from '@/lib/services/dashboard.service';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { TodaysCollectionsList } from '@/components/dashboard/TodaysCollectionsList';
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
    errorMsg =
      err instanceof Error && err.message.includes('DATABASE_URL')
        ? 'Database not connected. Please configure DATABASE_URL in .env.local to get started.'
        : 'Unable to connect to database. Please verify your Supabase connection.';
  }

  const todayFormatted = format(new Date(), 'EEEE, dd MMMM');

  return (
    <div>
      <Header
        title="Personal Loan Tracker"
        subtitle={todayFormatted}
      />

      <div className="p-4 space-y-6">
        {errorMsg ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 shadow-sm space-y-2">
            <h3 className="font-bold text-base">Setup Required</h3>
            <p className="text-sm leading-relaxed">{errorMsg}</p>
            <div className="rounded-xl bg-amber-100/70 p-3 text-xs font-mono text-amber-950">
              1. Add DATABASE_URL in .env.local
              <br />
              2. Run: npm run db:push
              <br />
              3. Run: npm run db:seed
            </div>
          </div>
        ) : summary ? (
          <>
            {/* Main Financial Metrics */}
            <DashboardMetrics summary={summary} />

            {/* Today's Collections */}
            <TodaysCollectionsList
              collections={summary.todayCollections.items}
              totalToday={summary.todayCollections.totalCollectedToday}
            />

            {/* Outstanding People */}
            <OutstandingPeopleList people={summary.outstandingPeople} />
          </>
        ) : null}
      </div>
    </div>
  );
}
