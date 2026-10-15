import { getPersonOptionById } from '@/lib/services/people.service';
import { LoanForm } from '@/components/loans/LoanForm';
import { Header } from '@/components/shared/Header';

export const dynamic = 'force-dynamic';

interface NewLoanPageProps {
  searchParams: Promise<{
    personId?: string;
  }>;
}

export default async function NewLoanPage({ searchParams }: NewLoanPageProps) {
  const { personId } = await searchParams;
  const defaultPerson = personId ? await getPersonOptionById(personId) : null;

  const backUrl = personId ? `/people/${personId}` : '/people';

  return (
    <div>
      <Header
        title="Create Loan"
        subtitle="Record a new loan"
        backHref={backUrl}
      />

      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <LoanForm
          defaultPerson={defaultPerson ?? undefined}
        />
      </div>
    </div>
  );
}
