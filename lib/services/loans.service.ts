import { readLocalDb, writeLocalDb, type Loan } from '@/lib/storage/local-store';
import { db, people, loans, collections, isDbConfigured } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface LoanWithFinancials extends Loan {
  personName: string;
  personPhone: string | null;
  totalCollected: number; // in paise
  remainingAmount: number; // in paise
  percentageCollected: number; // 0 - 100
  collectionCount: number;
}

export interface CollectionWithBalance {
  id: string;
  loanId: string;
  personId: string;
  amount: number; // in paise
  collectedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  remainingAfterCollection: number; // in paise
}

/**
 * Recalculates and updates loan status based on actual collection records.
 */
export async function syncLoanStatus(loanId: string): Promise<'ACTIVE' | 'COMPLETED'> {
  if (isDbConfigured()) {
    try {
      const [loanRecord] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, loanId));

      if (loanRecord) {
        const collectionsResult = await db
          .select({
            total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
          })
          .from(collections)
          .where(eq(collections.loanId, loanId));

        const totalCollected = Number(collectionsResult[0]?.total ?? 0);
        const remaining = Number(loanRecord.loanAmount) - totalCollected;
        const newStatus = remaining <= 0 ? 'COMPLETED' : 'ACTIVE';

        if (loanRecord.status !== newStatus) {
          await db
            .update(loans)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(loans.id, loanId));
        }

        return newStatus;
      }
    } catch (err) {
      console.warn('Database query failed in syncLoanStatus, falling back to local storage:', err);
    }
  }

  const local = readLocalDb();
  const loan = local.loans.find((l) => l.id === loanId);
  if (!loan) throw new Error('Loan not found');

  const totalCollected = local.collections
    .filter((c) => c.loanId === loanId)
    .reduce((sum, c) => sum + c.amount, 0);

  const remaining = loan.loanAmount - totalCollected;
  const newStatus = remaining <= 0 ? 'COMPLETED' : 'ACTIVE';

  if (loan.status !== newStatus) {
    loan.status = newStatus;
    loan.updatedAt = new Date().toISOString();
    writeLocalDb(local);
  }
  return newStatus;
}

/**
 * Gets a single loan with computed financials, running balances, and payment history.
 */
export async function getLoanById(id: string) {
  if (isDbConfigured()) {
    try {
      const [loanRecord] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, id));

      if (loanRecord) {
        const [person] = await db
          .select()
          .from(people)
          .where(eq(people.id, loanRecord.personId));

        const loanCols = await db
          .select()
          .from(collections)
          .where(eq(collections.loanId, id));

        // Sort chronologically ascending
        loanCols.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());

        let accumulated = 0;
        const collectionsWithBalance: CollectionWithBalance[] = [];

        for (const c of loanCols) {
          accumulated += Number(c.amount);
          const remainingAfter = Math.max(0, Number(loanRecord.loanAmount) - accumulated);
          collectionsWithBalance.push({
            id: c.id,
            loanId: c.loanId,
            personId: c.personId,
            amount: Number(c.amount),
            collectedAt: new Date(c.collectedAt),
            notes: c.notes,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            remainingAfterCollection: remainingAfter,
          });
        }

        const collectionsNewestFirst = [...collectionsWithBalance].reverse();
        const totalCollected = accumulated;
        const remainingAmount = Math.max(0, Number(loanRecord.loanAmount) - totalCollected);
        const percentageCollected =
          Number(loanRecord.loanAmount) > 0
            ? Math.min(100, Math.round((totalCollected / Number(loanRecord.loanAmount)) * 100))
            : 0;

        return {
          id: loanRecord.id,
          personId: loanRecord.personId,
          loanAmount: Number(loanRecord.loanAmount),
          loanDate: loanRecord.loanDate,
          dailyInstallment: loanRecord.dailyInstallment ? Number(loanRecord.dailyInstallment) : null,
          status: loanRecord.status as 'ACTIVE' | 'COMPLETED',
          notes: loanRecord.notes,
          createdAt: new Date(loanRecord.createdAt),
          updatedAt: new Date(loanRecord.updatedAt),
          personName: person?.fullName || 'Contact',
          personPhone: person?.phone || null,
          totalCollected,
          remainingAmount,
          percentageCollected,
          collectionCount: loanCols.length,
          collections: collectionsNewestFirst,
        };
      }
    } catch (err) {
      console.warn('Database query failed in getLoanById, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const loanRecord = local.loans.find((l) => l.id === id);
  if (!loanRecord) return null;

  const person = local.people.find((p) => p.id === loanRecord.personId);

  const loanCols = local.collections
    .filter((c) => c.loanId === id)
    .sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());

  let accumulated = 0;
  const collectionsWithBalance: CollectionWithBalance[] = [];

  for (const c of loanCols) {
    accumulated += c.amount;
    const remainingAfter = Math.max(0, loanRecord.loanAmount - accumulated);
    collectionsWithBalance.push({
      id: c.id,
      loanId: c.loanId,
      personId: c.personId,
      amount: c.amount,
      collectedAt: new Date(c.collectedAt),
      notes: c.notes,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      remainingAfterCollection: remainingAfter,
    });
  }

  const collectionsNewestFirst = [...collectionsWithBalance].reverse();
  const totalCollected = accumulated;
  const remainingAmount = Math.max(0, loanRecord.loanAmount - totalCollected);
  const percentageCollected =
    loanRecord.loanAmount > 0
      ? Math.min(100, Math.round((totalCollected / loanRecord.loanAmount) * 100))
      : 0;

  return {
    id: loanRecord.id,
    personId: loanRecord.personId,
    loanAmount: loanRecord.loanAmount,
    loanDate: loanRecord.loanDate,
    dailyInstallment: loanRecord.dailyInstallment,
    status: loanRecord.status,
    notes: loanRecord.notes,
    createdAt: new Date(loanRecord.createdAt),
    updatedAt: new Date(loanRecord.updatedAt),
    personName: person?.fullName || 'Contact',
    personPhone: person?.phone || null,
    totalCollected,
    remainingAmount,
    percentageCollected,
    collectionCount: loanCols.length,
    collections: collectionsNewestFirst,
  };
}

/**
 * Gets all loans for a specific person with computed totals.
 */
export async function getLoansByPersonId(personId: string): Promise<LoanWithFinancials[]> {
  if (isDbConfigured()) {
    try {
      const personLoans = await db
        .select()
        .from(loans)
        .where(eq(loans.personId, personId));

      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, personId));

      personLoans.sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());

      const result: LoanWithFinancials[] = [];

      for (const item of personLoans) {
        const cols = await db
          .select({
            total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
            count: sql<string>`COUNT(${collections.id})`,
          })
          .from(collections)
          .where(eq(collections.loanId, item.id));

        const totalCollected = Number(cols[0]?.total ?? 0);
        const collectionCount = Number(cols[0]?.count ?? 0);
        const remainingAmount = Math.max(0, Number(item.loanAmount) - totalCollected);
        const percentageCollected =
          Number(item.loanAmount) > 0
            ? Math.min(100, Math.round((totalCollected / Number(item.loanAmount)) * 100))
            : 0;

        result.push({
          id: item.id,
          personId: item.personId,
          loanAmount: Number(item.loanAmount),
          loanDate: item.loanDate,
          dailyInstallment: item.dailyInstallment ? Number(item.dailyInstallment) : null,
          status: item.status as 'ACTIVE' | 'COMPLETED',
          notes: item.notes,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          personName: person?.fullName || 'Contact',
          personPhone: person?.phone || null,
          totalCollected,
          remainingAmount,
          percentageCollected,
          collectionCount,
        });
      }

      return result;
    } catch (err) {
      console.warn('Database query failed in getLoansByPersonId, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const person = local.people.find((p) => p.id === personId);
  const personLoans = local.loans
    .filter((l) => l.personId === personId)
    .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());

  const result: LoanWithFinancials[] = [];

  for (const item of personLoans) {
    const loanCols = local.collections.filter((c) => c.loanId === item.id);
    const totalCollected = loanCols.reduce((sum, c) => sum + c.amount, 0);
    const remainingAmount = Math.max(0, item.loanAmount - totalCollected);
    const percentageCollected =
      item.loanAmount > 0
        ? Math.min(100, Math.round((totalCollected / item.loanAmount) * 100))
        : 0;

    result.push({
      id: item.id,
      personId: item.personId,
      loanAmount: item.loanAmount,
      loanDate: item.loanDate,
      dailyInstallment: item.dailyInstallment,
      status: item.status,
      notes: item.notes,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      personName: person?.fullName || 'Contact',
      personPhone: person?.phone || null,
      totalCollected,
      remainingAmount,
      percentageCollected,
      collectionCount: loanCols.length,
    });
  }

  return result;
}

/**
 * Creates a new loan for a person.
 */
export async function createLoan(data: {
  personId: string;
  loanAmountPaise: number;
  loanDate: string;
  dailyInstallmentPaise?: number | null;
  notes?: string | null;
}) {
  const newId = randomUUID();
  const now = new Date();

  if (isDbConfigured()) {
    try {
      await db.insert(loans).values({
        id: newId,
        personId: data.personId,
        loanAmount: data.loanAmountPaise,
        loanDate: data.loanDate,
        dailyInstallment: data.dailyInstallmentPaise || null,
        status: 'ACTIVE',
        notes: data.notes || null,
      });

      return {
        id: newId,
        personId: data.personId,
        loanAmount: data.loanAmountPaise,
        loanDate: data.loanDate,
        dailyInstallment: data.dailyInstallmentPaise || null,
        status: 'ACTIVE' as const,
        notes: data.notes || null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      console.warn('Database insert failed in createLoan, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const nowIso = now.toISOString();

  const newLoanRecord = {
    id: newId,
    personId: data.personId,
    loanAmount: data.loanAmountPaise,
    loanDate: data.loanDate,
    dailyInstallment: data.dailyInstallmentPaise || null,
    status: 'ACTIVE' as const,
    notes: data.notes || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  local.loans.push(newLoanRecord);
  writeLocalDb(local);

  return {
    ...newLoanRecord,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Deletes a loan and cascades collections.
 */
export async function deleteLoan(loanId: string) {
  if (isDbConfigured()) {
    try {
      await db.delete(collections).where(eq(collections.loanId, loanId));
      await db.delete(loans).where(eq(loans.id, loanId));
      return true;
    } catch (err) {
      console.warn('Database delete failed in deleteLoan, falling back to local storage:', err);
    }
  }

  const local = readLocalDb();
  local.loans = local.loans.filter((l) => l.id !== loanId);
  local.collections = local.collections.filter((c) => c.loanId !== loanId);
  writeLocalDb(local);
  return true;
}
