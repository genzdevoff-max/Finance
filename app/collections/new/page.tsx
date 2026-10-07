import { AddCollectionForm, type PersonWithLoansData } from '@/components/collections/AddCollectionForm';
import { Header } from '@/components/shared/Header';
import { readLocalDb } from '@/lib/storage/local-store';

export const dynamic = 'force-dynamic';

interface NewCollectionPageProps {
  searchParams: Promise<{
    personId?: string;
    loanId?: string;
  }>;
}

export default async function NewCollectionPage({ searchParams }: NewCollectionPageProps) {
  const { personId, loanId } = await searchParams;

  const peopleMap = new Map<string, PersonWithLoansData>();
  const local = readLocalDb();
  const activeLoans = local.loans.filter((l) => l.status === 'ACTIVE');

  for (const loanItem of activeLoans) {
    const person = local.people.find((p) => p.id === loanItem.personId);
    if (!person) continue;

    const totalCollected = local.collections
      .filter((c) => c.loanId === loanItem.id)
      .reduce((sum, c) => sum + c.amount, 0);

    const remainingAmount = Math.max(0, loanItem.loanAmount - totalCollected);
    if (remainingAmount <= 0) continue;

    if (!peopleMap.has(person.id)) {
      peopleMap.set(person.id, {
        id: person.id,
        fullName: person.fullName,
        phone: person.phone,
        activeLoans: [],
      });
    }

    peopleMap.get(person.id)!.activeLoans.push({
      id: loanItem.id,
      loanAmount: loanItem.loanAmount,
      loanDate: loanItem.loanDate,
      dailyInstallment: loanItem.dailyInstallment,
      remainingAmount,
    });
  }

  const peopleWithLoans = Array.from(peopleMap.values());

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
