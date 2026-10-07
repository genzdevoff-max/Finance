import {
  getCollectionsHistory,
  type HistoryFilterRange,
} from '@/lib/services/collections.service';
import { getPeopleList } from '@/lib/services/people.service';
import { HistoryView } from '@/components/history/HistoryView';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface HistoryPageProps {
  searchParams: Promise<{
    range?: HistoryFilterRange;
    personId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { range = 'all', personId, startDate, endDate } = await searchParams;

  const [historyResult, people] = await Promise.all([
    getCollectionsHistory({
      range,
      personId,
      startDate,
      endDate,
    }),
    getPeopleList(),
  ]);

  const peopleChoices = people.map((p) => ({
    id: p.id,
    fullName: p.fullName,
  }));

  return (
    <div>
      <Header
        title="Collection History"
        subtitle="All recorded repayments"
      />

      <div className="p-4">
        <HistoryView
          initialItems={historyResult.items}
          totalCollected={historyResult.totalCollected}
          totalCount={historyResult.count}
          peopleList={peopleChoices}
          currentRange={range}
          currentPersonId={personId}
          currentStartDate={startDate}
          currentEndDate={endDate}
        />
      </div>
    </div>
  );
}
