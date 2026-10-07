import { notFound } from 'next/navigation';
import { getPersonById } from '@/lib/services/people.service';
import { PersonForm } from '@/components/people/PersonForm';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface EditPersonPageProps {
  params: Promise<{
    personId: string;
  }>;
}

export default async function EditPersonPage({ params }: EditPersonPageProps) {
  const { personId } = await params;
  const person = await getPersonById(personId);

  if (!person) {
    notFound();
  }

  return (
    <div>
      <Header
        title={`Edit ${person.fullName}`}
        subtitle="Update borrower information"
        backHref={`/people/${personId}`}
      />

      <div className="p-4">
        <PersonForm
          personId={person.id}
          initialData={{
            fullName: person.fullName,
            phone: person.phone,
            address: person.address,
            notes: person.notes,
          }}
        />
      </div>
    </div>
  );
}
