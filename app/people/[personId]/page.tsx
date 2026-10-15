import { notFound } from 'next/navigation';
import { getPersonById } from '@/lib/services/people.service';
import { PersonDetailsView } from '@/components/people/PersonDetailsView';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface PersonDetailPageProps {
  params: Promise<{
    personId: string;
  }>;
  searchParams: Promise<{ loanPage?: string }>;
}

export default async function PersonDetailPage({ params, searchParams }: PersonDetailPageProps) {
  const [{ personId }, query] = await Promise.all([params, searchParams]);
  const requestedPage = Number(query.loanPage);
  const loanPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const person = await getPersonById(personId, loanPage);

  if (!person) {
    notFound();
  }

  return (
    <div>
      <Header
        title={person.fullName}
        subtitle="Person Details"
        backHref="/people"
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PersonDetailsView person={person} />
      </div>
    </div>
  );
}
