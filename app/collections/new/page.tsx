import { db } from '@/lib/db';
import { people, loans, collections } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { AddCollectionForm, type PersonWithLoansData } from '@/components/collections/AddCollectionForm';
import { Header } from '@/components/shared/Header';
import { isLocalMode, readLocalDb } from '@/lib/storage/local-store';

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

  if (isLocalMode()) {
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
  } else {
    // PostgreSQL Mode
    const activeLoansList = await db
      .select({
        loan: loans,
        personName: people.fullName,
        personPhone: people.phone,
      })
      .from(loans)
      .innerJoin(people, eq(loans.personId, people.id))
      .where(eq(loans.status, 'ACTIVE'));

    for (const item of activeLoansList) {
      const colSum = await db
        .select({
          total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
        })
        .from(collections)
        .where(eq(collections.loanId, item.loan.id));

      const totalCollected = Number(colSum[0]?.total ?? 0);
      const remainingAmount = Math.max(0, item.loan.loanAmount - totalCollected);

      if (remainingAmount <= 0) continue;

      if (!peopleMap.has(item.loan.personId)) {
        peopleMap.set(item.loan.personId, {
          id: item.loan.personId,
          fullName: item.personName,
          phone: item.personPhone,
          activeLoans: [],
        });
      }

      peopleMap.get(item.loan.personId)!.activeLoans.push({
        id: item.loan.id,
        loanAmount: item.loan.loanAmount,
        loanDate: item.loan.loanDate,
        dailyInstallment: item.loan.dailyInstallment,
        remainingAmount,
      });
    }
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
