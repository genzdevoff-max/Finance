import { getPeopleListPage } from '@/lib/services/people.service';
import { PeopleList } from '@/components/people/PeopleList';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface PeoplePageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = params.search?.trim() || '';
  const pageSize = 25;
  const result = await getPeopleListPage(search, page, pageSize);

  return (
    <div>
      <Header
        title="People"
        subtitle={`${result.totalCount} ${result.totalCount === 1 ? 'person' : 'people'} registered`}
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PeopleList
          initialPeople={result.items}
          totalCount={result.totalCount}
          currentPage={result.currentPage}
          pageSize={pageSize}
          currentSearch={search}
        />
      </div>
    </div>
  );
}
