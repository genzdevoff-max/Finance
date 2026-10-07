import { getPeopleList } from '@/lib/services/people.service';
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
  const people = await getPeopleList();

  const borrowerChoices = people.map((p) => ({
    id: p.id,
    fullName: p.fullName,
  }));

  const backUrl = personId ? `/people/${personId}` : '/people';

  return (
    <div>
      <Header
        title="Create Loan"
        subtitle="Record a new loan"
        backHref={backUrl}
      />

      <div className="p-4">
        <LoanForm
          people={borrowerChoices}
          defaultPersonId={personId}
        />
      </div>
    </div>
  );
}
