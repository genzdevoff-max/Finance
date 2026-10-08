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

      <div className="p-4">
        <PersonForm />
      </div>
    </div>
  );
}
