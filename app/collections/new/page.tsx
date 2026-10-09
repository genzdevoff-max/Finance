import { AddCollectionForm, type PersonWithLoansData } from '@/components/collections/AddCollectionForm';
import { Header } from '@/components/shared/Header';
import { getPeopleList } from '@/lib/services/people.service';
import { getLoansByPersonId } from '@/lib/services/loans.service';

export const dynamic = 'force-dynamic';

interface NewCollectionPageProps {
  searchParams: Promise<{
    personId?: string;
    loanId?: string;
  }>;
}

export default async function NewCollectionPage({ searchParams }: NewCollectionPageProps) {
  const { personId, loanId } = await searchParams;

  const registeredPeople = await getPeopleList();
  const peopleWithLoans = (
    await Promise.all(
      registeredPeople.map(async (person): Promise<PersonWithLoansData | null> => {
        const loans = await getLoansByPersonId(person.id);
        const activeLoans = loans
          .filter((loan) => loan.status === 'ACTIVE' && loan.remainingAmount > 0)
          .map((loan) => ({
            id: loan.id,
            loanAmount: loan.loanAmount,
            loanDate: loan.loanDate,
            dailyInstallment: loan.dailyInstallment,
            installmentFrequency: loan.installmentFrequency,
            remainingAmount: loan.remainingAmount,
          }));

        if (activeLoans.length === 0) return null;

        return {
          id: person.id,
          fullName: person.fullName,
          phone: person.phone,
          activeLoans,
        };
      })
    )
  ).filter((person): person is PersonWithLoansData => person !== null);

  return (
    <div>
      <Header
        title="Add Collection"
        subtitle="Quick repayment entry"
        backHref="/dashboard"
      />

      <div className="p-4">
        <AddCollectionForm
          people={peopleWithLoans}
          initialPersonId={personId}
          initialLoanId={loanId}
        />
      </div>
    </div>
  );
}
