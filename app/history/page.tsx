import { Suspense } from 'react';
import {
  getFinancialActivityHistory,
  type HistoryFilterRange,
} from '@/lib/services/collections.service';
import { getPersonOptionById } from '@/lib/services/people.service';
import { HistoryView } from '@/components/history/HistoryView';
import { Header } from '@/components/shared/Header';
import { Skeleton } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';

interface HistoryPageProps {
  searchParams: Promise<{
    range?: HistoryFilterRange;
    personId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    search?: string;
  }>;
}

async function HistoryData({ searchParams }: HistoryPageProps) {
  const { range = 'all', personId, startDate, endDate, page, search } = await searchParams;
  const requestedPage = Number(page);
  const currentPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [historyResult, selectedPerson] = await Promise.all([
    getFinancialActivityHistory({
      range,
      personId,
      startDate,
      endDate,
      search,
      page: currentPage,
      pageSize: 25,
    }),
    personId ? getPersonOptionById(personId) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <HistoryView
        initialItems={historyResult.items}
        totalCollected={historyResult.totalCollected}
        totalInvested={historyResult.totalInvested}
        collectionCount={historyResult.collectionCount}
        investmentCount={historyResult.investmentCount}
        totalCount={historyResult.count}
        currentPage={historyResult.page}
        pageSize={historyResult.pageSize}
        initialPerson={selectedPerson}
        currentRange={range}
        currentPersonId={personId}
        currentStartDate={startDate}
        currentEndDate={endDate}
        currentSearch={search}
      />
    </div>
  );
}

export default function HistoryPage(props: HistoryPageProps) {
  return (
    <div>
      <Header
        title="Financial Activity History"
        subtitle="Loan investments and repayments"
      />
      <Suspense
        fallback={
          <div className="p-4 space-y-4" aria-label="Loading collection history" role="status">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        }
      >
        <HistoryData searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
