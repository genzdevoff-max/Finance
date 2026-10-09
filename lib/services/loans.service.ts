import type { Loan } from '@/lib/db/schema';
import { db, people, loans, collections, isDbConfigured, assertDbConfigured } from '@/lib/db';
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
  assertDbConfigured();
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
      throw new Error('Loan not found');
    } catch (err) {
      console.error('Database query failed in syncLoanStatus:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Gets a single loan with computed financials, running balances, and payment history.
 */
export async function getLoanById(id: string) {
  assertDbConfigured();
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
          installmentFrequency: loanRecord.installmentFrequency,
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
      return null;
    } catch (err) {
      console.error('Database query failed in getLoanById:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Gets all loans for a specific person with computed totals.
 */
export async function getLoansByPersonId(personId: string): Promise<LoanWithFinancials[]> {
  assertDbConfigured();
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
          installmentFrequency: item.installmentFrequency,
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
      console.error('Database query failed in getLoansByPersonId:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Creates a new loan for a person.
 */
export async function createLoan(data: {
  personId: string;
  loanAmountPaise: number;
  loanDate: string;
  dailyInstallmentPaise?: number | null;
  installmentFrequency: Loan['installmentFrequency'];
  notes?: string | null;
}) {
  assertDbConfigured();
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
        installmentFrequency: data.installmentFrequency,
        status: 'ACTIVE',
        notes: data.notes || null,
      });

      return {
        id: newId,
        personId: data.personId,
        loanAmount: data.loanAmountPaise,
        loanDate: data.loanDate,
        dailyInstallment: data.dailyInstallmentPaise || null,
        installmentFrequency: data.installmentFrequency,
        status: 'ACTIVE' as const,
        notes: data.notes || null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      console.error('Database insert failed in createLoan:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

export async function updateLoanSchedule(data: {
  loanId: string;
  installmentPaise: number | null;
  installmentFrequency: Loan['installmentFrequency'];
}) {
  assertDbConfigured();
  if (data.installmentPaise !== null && data.installmentPaise <= 0) {
    throw new Error('Installment amount must be greater than ₹0.');
  }

  try {
    const [existingLoan] = await db.select().from(loans).where(eq(loans.id, data.loanId));
    if (!existingLoan) throw new Error('Loan not found.');

    const now = new Date();
    await db
      .update(loans)
      .set({
        dailyInstallment: data.installmentPaise,
        installmentFrequency: data.installmentFrequency,
        updatedAt: now,
      })
      .where(eq(loans.id, data.loanId));

    return {
      loanId: data.loanId,
      dailyInstallment: data.installmentPaise,
      installmentFrequency: data.installmentFrequency,
    };
  } catch (err) {
    console.error('Database update failed in updateLoanSchedule:', err);
    throw err;
  }
}

/**
 * Deletes a loan and cascades collections.
 */
export async function deleteLoan(loanId: string) {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const [existingLoan] = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId));
      if (!existingLoan) throw new Error('Loan not found');

      await db.delete(collections).where(eq(collections.loanId, loanId));
      await db.delete(loans).where(eq(loans.id, loanId));
      return true;
    } catch (err) {
      console.error('Database delete failed in deleteLoan:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}
