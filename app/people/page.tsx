import { getPeopleList, type PersonWithFinancials } from '@/lib/services/people.service';
import { PeopleList } from '@/components/people/PeopleList';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const peopleList: PersonWithFinancials[] = await getPeopleList();

  return (
    <div>
      <Header
        title="People"
        subtitle={`${peopleList.length} ${peopleList.length === 1 ? 'person' : 'people'} registered`}
      />

      <div className="p-4">
        <PeopleList initialPeople={peopleList} />
      </div>
    </div>
  );
}
