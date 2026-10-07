import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loans, collections, people, type Loan } from '@/lib/db/schema';
import { isLocalMode, readLocalDb, writeLocalDb } from '@/lib/storage/local-store';
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
  if (isLocalMode()) {
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

  const [loanRecord] = await db
    .select({
      id: loans.id,
      loanAmount: loans.loanAmount,
      status: loans.status,
    })
    .from(loans)
    .where(eq(loans.id, loanId));

  if (!loanRecord) {
    throw new Error('Loan not found');
  }

  const collectionsResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
    })
    .from(collections)
    .where(eq(collections.loanId, loanId));

  const totalCollected = Number(collectionsResult[0]?.total ?? 0);
  const remaining = loanRecord.loanAmount - totalCollected;

  const newStatus = remaining <= 0 ? 'COMPLETED' : 'ACTIVE';

  if (loanRecord.status !== newStatus) {
    await db
      .update(loans)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loanId));
  }

  return newStatus;
}

/**
 * Gets a single loan with computed financials, running balances, and payment history.
 */
export async function getLoanById(id: string) {
  if (isLocalMode()) {
    const local = readLocalDb();
    const loanRecord = local.loans.find((l) => l.id === id);
    if (!loanRecord) return null;

    const person = local.people.find((p) => p.id === loanRecord.personId);

    // Filter collections and sort chronologically ascending
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
      personName: person?.fullName || 'Borrower',
      personPhone: person?.phone || null,
      totalCollected,
      remainingAmount,
      percentageCollected,
      collectionCount: loanCols.length,
      collections: collectionsNewestFirst,
    };
  }

  const [loanRecord] = await db
    .select({
      loan: loans,
      personName: people.fullName,
      personPhone: people.phone,
    })
    .from(loans)
    .innerJoin(people, eq(loans.personId, people.id))
    .where(eq(loans.id, id));

  if (!loanRecord) return null;

  const loanCollectionsAsc = await db
    .select()
    .from(collections)
    .where(eq(collections.loanId, id))
    .orderBy(collections.collectedAt, collections.createdAt);

  let accumulated = 0;
  const collectionsWithBalance: CollectionWithBalance[] = [];

  for (const c of loanCollectionsAsc) {
    accumulated += c.amount;
    const remainingAfter = Math.max(0, loanRecord.loan.loanAmount - accumulated);
    collectionsWithBalance.push({
      ...c,
      remainingAfterCollection: remainingAfter,
    });
  }

  const collectionsNewestFirst = [...collectionsWithBalance].reverse();

  const totalCollected = accumulated;
  const remainingAmount = Math.max(0, loanRecord.loan.loanAmount - totalCollected);
  const percentageCollected =
    loanRecord.loan.loanAmount > 0
      ? Math.min(100, Math.round((totalCollected / loanRecord.loan.loanAmount) * 100))
      : 0;

  return {
    ...loanRecord.loan,
    personName: loanRecord.personName,
    personPhone: loanRecord.personPhone,
    totalCollected,
    remainingAmount,
    percentageCollected,
    collectionCount: loanCollectionsAsc.length,
    collections: collectionsNewestFirst,
  };
}

/**
 * Gets all loans for a specific person with computed totals.
 */
export async function getLoansByPersonId(personId: string): Promise<LoanWithFinancials[]> {
  if (isLocalMode()) {
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
        personName: person?.fullName || 'Borrower',
        personPhone: person?.phone || null,
        totalCollected,
        remainingAmount,
        percentageCollected,
        collectionCount: loanCols.length,
      });
    }

    return result;
  }

  const personLoans = await db
    .select({
      loan: loans,
      personName: people.fullName,
      personPhone: people.phone,
    })
    .from(loans)
    .innerJoin(people, eq(loans.personId, people.id))
    .where(eq(loans.personId, personId))
    .orderBy(desc(loans.loanDate), desc(loans.createdAt));

  const result: LoanWithFinancials[] = [];

  for (const item of personLoans) {
    const colResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
        count: sql<string>`COUNT(${collections.id})`,
      })
      .from(collections)
      .where(eq(collections.loanId, item.loan.id));

    const totalCollected = Number(colResult[0]?.total ?? 0);
    const count = Number(colResult[0]?.count ?? 0);
    const remainingAmount = Math.max(0, item.loan.loanAmount - totalCollected);
    const percentageCollected =
      item.loan.loanAmount > 0
        ? Math.min(100, Math.round((totalCollected / item.loan.loanAmount) * 100))
        : 0;

    result.push({
      ...item.loan,
      personName: item.personName,
      personPhone: item.personPhone,
      totalCollected,
      remainingAmount,
      percentageCollected,
      collectionCount: count,
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
  if (isLocalMode()) {
    const local = readLocalDb();
    const newId = randomUUID();
    const nowIso = new Date().toISOString();

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
      createdAt: new Date(newLoanRecord.createdAt),
      updatedAt: new Date(newLoanRecord.updatedAt),
    };
  }

  const [newLoan] = await db
    .insert(loans)
    .values({
      personId: data.personId,
      loanAmount: data.loanAmountPaise,
      loanDate: data.loanDate,
      dailyInstallment: data.dailyInstallmentPaise || null,
      status: 'ACTIVE',
      notes: data.notes || null,
    })
    .returning();

  return newLoan;
}

/**
 * Deletes a loan and cascades collections.
 */
export async function deleteLoan(loanId: string) {
  if (isLocalMode()) {
    const local = readLocalDb();
    local.loans = local.loans.filter((l) => l.id !== loanId);
    local.collections = local.collections.filter((c) => c.loanId !== loanId);
    writeLocalDb(local);
    return true;
  }

  await db.delete(loans).where(eq(loans.id, loanId));
  return true;
}
