import { notFound } from 'next/navigation';
import { getPersonById } from '@/lib/services/people.service';
import { PersonDetailsView } from '@/components/people/PersonDetailsView';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface PersonDetailPageProps {
  params: Promise<{
    personId: string;
  }>;
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { personId } = await params;
  const person = await getPersonById(personId);

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

      <div className="p-4">
        <PersonDetailsView person={person} />
      </div>
    </div>
  );
}
