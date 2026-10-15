import { PersonForm } from '@/components/people/PersonForm';
import { Header } from '@/components/shared/Header';

export default function NewPersonPage() {
  return (
    <div>
      <Header
        title="Add Person"
        subtitle="Register a new person"
        backHref="/people"
      />

      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <PersonForm />
      </div>
    </div>
  );
}
