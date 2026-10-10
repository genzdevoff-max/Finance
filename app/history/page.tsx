import { Suspense } from 'react';
import {
  getCollectionsHistory,
  type HistoryFilterRange,
} from '@/lib/services/collections.service';
import { getPeopleList } from '@/lib/services/people.service';
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
  }>;
}

async function HistoryData({ searchParams }: HistoryPageProps) {
  const { range = 'all', personId, startDate, endDate, page } = await searchParams;
  const requestedPage = Number(page);
  const currentPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [historyResult, people] = await Promise.all([
    getCollectionsHistory({
      range,
      personId,
      startDate,
      endDate,
      page: currentPage,
      pageSize: 50,
    }),
    getPeopleList(),
  ]);

  const peopleChoices = people.map((p) => ({
    id: p.id,
    fullName: p.fullName,
  }));

  return (
    <div className="p-4">
      <HistoryView
        initialItems={historyResult.items}
        totalCollected={historyResult.totalCollected}
        totalCount={historyResult.count}
        currentPage={historyResult.page}
        pageSize={historyResult.pageSize}
        peopleList={peopleChoices}
        currentRange={range}
        currentPersonId={personId}
        currentStartDate={startDate}
        currentEndDate={endDate}
      />
    </div>
  );
}

export default function HistoryPage(props: HistoryPageProps) {
  return (
    <div>
      <Header
        title="Collection History"
        subtitle="All recorded repayments"
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
