import type { Loan } from '@/lib/db/schema';
import { db, people, loans, collections, isDbConfigured, assertDbConfigured } from '@/lib/db';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { addDaysToDateString, getLoanExpiryState } from '@/lib/utils/date';

export interface LoanWithFinancials extends Loan {
  personName: string;
  personPhone: string | null;
  durationDays: number | null;
  expectedEndDate: string | null;
  remainingDays: number;
  isExpired: boolean;
  expiryLabel: string;
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

export interface PersonWithActiveLoansForCollection {
  id: string;
  fullName: string;
  phone: string | null;
  activeLoans: {
    id: string;
    loanAmount: number;
    loanDate: string;
    dailyInstallment: number | null;
    installmentFrequency: Loan['installmentFrequency'];
    remainingAmount: number;
  }[];
}

/**
 * Loads active loans for a bounded set of matching people.
 */
export async function getPeopleWithActiveLoansForCollection(
  searchQuery?: string,
  personId?: string
): Promise<
  PersonWithActiveLoansForCollection[]
> {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const term = searchQuery?.trim().toLowerCase();
      const personFilter = personId
        ? eq(people.id, personId)
        : term && term.length >= 2
          ? or(
              sql`LOWER(${people.fullName}) LIKE ${`%${term}%`}`,
              sql`LOWER(${people.phone}) LIKE ${`%${term}%`}`
            )
          : undefined;
      if (!personFilter) return [];

      const matchedPeople = await db
        .select({ id: people.id })
        .from(people)
        .innerJoin(loans, eq(loans.personId, people.id))
        .where(and(personFilter, eq(loans.status, 'ACTIVE')))
        .groupBy(people.id, people.fullName)
        .orderBy(asc(people.fullName), asc(people.id))
        .limit(10);
      if (matchedPeople.length === 0) return [];

      const rows = await db
        .select({
          personId: people.id,
          fullName: people.fullName,
          phone: people.phone,
          loanId: loans.id,
          loanAmount: loans.loanAmount,
          loanDate: loans.loanDate,
          dailyInstallment: loans.dailyInstallment,
          installmentFrequency: loans.installmentFrequency,
          totalCollected: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
        })
        .from(loans)
        .innerJoin(people, eq(people.id, loans.personId))
        .leftJoin(collections, eq(collections.loanId, loans.id))
        .where(
          and(
            eq(loans.status, 'ACTIVE'),
            inArray(
              loans.personId,
              matchedPeople.map((person) => person.id)
            )
          )
        )
        .groupBy(
          loans.id,
          people.id,
          people.fullName,
          people.phone,
          loans.loanAmount,
          loans.loanDate,
          loans.dailyInstallment,
          loans.installmentFrequency
        )
        .orderBy(people.fullName, desc(loans.loanDate));

      const peopleById = new Map<string, PersonWithActiveLoansForCollection>();
      for (const row of rows) {
        const remainingAmount = Math.max(
          0,
          Number(row.loanAmount) - Number(row.totalCollected)
        );
        if (remainingAmount === 0) continue;

        let person = peopleById.get(row.personId);
        if (!person) {
          person = {
            id: row.personId,
            fullName: row.fullName,
            phone: row.phone,
            activeLoans: [],
          };
          peopleById.set(row.personId, person);
        }

        person.activeLoans.push({
          id: row.loanId,
          loanAmount: Number(row.loanAmount),
          loanDate: row.loanDate,
          dailyInstallment: row.dailyInstallment === null ? null : Number(row.dailyInstallment),
          installmentFrequency: row.installmentFrequency,
          remainingAmount,
        });
      }

      return Array.from(peopleById.values());
    } catch (err) {
      console.error('Database query failed in getPeopleWithActiveLoansForCollection:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
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
export async function getLoanById(id: string, requestedPage = 1) {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const [loanResult] = await db
        .select({
          loan: loans,
          personName: people.fullName,
          personPhone: people.phone,
        })
        .from(loans)
        .leftJoin(people, eq(people.id, loans.personId))
        .where(eq(loans.id, id));

      if (loanResult) {
        const { loan: loanRecord, personName, personPhone } = loanResult;
        const pageSize = 50;
        const requestedCollectionPage = Math.max(1, Math.floor(requestedPage));
        const runningCollections = db
          .select({
            id: collections.id,
            loanId: collections.loanId,
            personId: collections.personId,
            amount: collections.amount,
            collectedAt: collections.collectedAt,
            notes: collections.notes,
            createdAt: collections.createdAt,
            updatedAt: collections.updatedAt,
            accumulatedAmount: sql<number>`
              SUM(${collections.amount}) OVER (
                ORDER BY ${collections.collectedAt} ASC, ${collections.id} ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              )
            `.as('accumulated_amount'),
          })
          .from(collections)
          .where(eq(collections.loanId, id))
          .as('running_collections');
        const [collectionSummaryRows, requestedCollectionRows] = await Promise.all([
          db
            .select({
              totalCollected: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
              count: sql<number>`COUNT(*)`,
            })
            .from(collections)
            .where(eq(collections.loanId, id)),
          db
            .select()
            .from(runningCollections)
            .orderBy(desc(runningCollections.collectedAt), desc(runningCollections.id))
            .limit(pageSize)
            .offset((requestedCollectionPage - 1) * pageSize),
        ]);
        const collectionCount = Number(collectionSummaryRows[0]?.count ?? 0);
        const collectionPageCount = Math.max(1, Math.ceil(collectionCount / pageSize));
        const collectionPage = Math.min(requestedCollectionPage, collectionPageCount);
        const collectionRows =
          collectionPage === requestedCollectionPage
            ? requestedCollectionRows
            : await db
                .select()
                .from(runningCollections)
                .orderBy(desc(runningCollections.collectedAt), desc(runningCollections.id))
                .limit(pageSize)
                .offset((collectionPage - 1) * pageSize);
        const totalCollected = Number(collectionSummaryRows[0]?.totalCollected ?? 0);
        const collectionsNewestFirst: CollectionWithBalance[] = collectionRows.map((c) => ({
          id: c.id,
          loanId: c.loanId,
          personId: c.personId,
          amount: Number(c.amount),
          collectedAt: new Date(c.collectedAt),
          notes: c.notes,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          remainingAfterCollection: Math.max(
            0,
            Number(loanRecord.loanAmount) - Number(c.accumulatedAmount)
          ),
        }));
        const remainingAmount = Math.max(0, Number(loanRecord.loanAmount) - totalCollected);
        const percentageCollected =
          Number(loanRecord.loanAmount) > 0
            ? Math.min(100, Math.round((totalCollected / Number(loanRecord.loanAmount)) * 100))
            : 0;

        const expiry = getLoanExpiryState(loanRecord.expectedEndDate || addDaysToDateString(loanRecord.loanDate, loanRecord.durationDays ?? 0) || null);
        return {
          id: loanRecord.id,
          personId: loanRecord.personId,
          loanAmount: Number(loanRecord.loanAmount),
          loanDate: loanRecord.loanDate,
          durationDays: loanRecord.durationDays ?? null,
          expectedEndDate: loanRecord.expectedEndDate || addDaysToDateString(loanRecord.loanDate, loanRecord.durationDays ?? 0) || null,
          dailyInstallment: loanRecord.dailyInstallment ? Number(loanRecord.dailyInstallment) : null,
          installmentFrequency: loanRecord.installmentFrequency,
          status: loanRecord.status as 'ACTIVE' | 'COMPLETED',
          notes: loanRecord.notes,
          createdAt: new Date(loanRecord.createdAt),
          updatedAt: new Date(loanRecord.updatedAt),
          personName: personName || 'Contact',
          personPhone: personPhone || null,
          remainingDays: expiry.remainingDays,
          isExpired: expiry.isExpired,
          expiryLabel: expiry.label,
          totalCollected,
          remainingAmount,
          percentageCollected,
          collectionCount,
          collectionPage,
          collectionPageSize: pageSize,
          collectionTotalPages: collectionPageCount,
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
export async function getLoansByPersonId(personId: string, requestedPage = 1) {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const pageSize = 25;
      const safeRequestedPage =
        Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const collectionTotals = db
        .select({
          loanId: collections.loanId,
          totalCollected: sql<string>`SUM(${collections.amount})`.as('total_collected'),
          collectionCount: sql<string>`COUNT(${collections.id})`.as('collection_count'),
        })
        .from(collections)
        .innerJoin(loans, eq(loans.id, collections.loanId))
        .where(eq(loans.personId, personId))
        .groupBy(collections.loanId)
        .as('collection_totals');

      const [countRows, requestedRows] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(loans)
          .where(eq(loans.personId, personId)),
        db
          .select({
            loan: loans,
            personName: people.fullName,
            personPhone: people.phone,
            totalCollected: sql<string>`COALESCE(${collectionTotals.totalCollected}, 0)`,
            collectionCount: sql<string>`COALESCE(${collectionTotals.collectionCount}, 0)`,
          })
          .from(loans)
          .innerJoin(people, eq(people.id, loans.personId))
          .leftJoin(collectionTotals, eq(collectionTotals.loanId, loans.id))
          .where(eq(loans.personId, personId))
          .orderBy(desc(loans.loanDate), desc(loans.id))
          .limit(pageSize)
          .offset((safeRequestedPage - 1) * pageSize),
      ]);
      const totalCount = Number(countRows[0]?.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const currentPage = Math.min(safeRequestedPage, totalPages);
      const rows =
        currentPage === safeRequestedPage
          ? requestedRows
          : await db
              .select({
                loan: loans,
                personName: people.fullName,
                personPhone: people.phone,
                totalCollected: sql<string>`COALESCE(${collectionTotals.totalCollected}, 0)`,
                collectionCount: sql<string>`COALESCE(${collectionTotals.collectionCount}, 0)`,
              })
              .from(loans)
              .innerJoin(people, eq(people.id, loans.personId))
              .leftJoin(collectionTotals, eq(collectionTotals.loanId, loans.id))
              .where(eq(loans.personId, personId))
              .orderBy(desc(loans.loanDate), desc(loans.id))
              .limit(pageSize)
              .offset((currentPage - 1) * pageSize);

      const items = rows.map(({ loan, personName, personPhone, totalCollected, collectionCount }) => {
        const collected = Number(totalCollected);
        const remainingAmount = Math.max(0, Number(loan.loanAmount) - collected);
        const percentageCollected =
          Number(loan.loanAmount) > 0
            ? Math.min(100, Math.round((collected / Number(loan.loanAmount)) * 100))
            : 0;
        const expectedEndDate =
          loan.expectedEndDate || addDaysToDateString(loan.loanDate, loan.durationDays ?? 0) || null;
        const expiry = getLoanExpiryState(expectedEndDate);
        return {
          ...loan,
          loanAmount: Number(loan.loanAmount),
          durationDays: loan.durationDays ?? null,
          expectedEndDate,
          dailyInstallment: loan.dailyInstallment ? Number(loan.dailyInstallment) : null,
          status: loan.status as 'ACTIVE' | 'COMPLETED',
          personName: personName || 'Contact',
          personPhone,
          remainingDays: expiry.remainingDays,
          isExpired: expiry.isExpired,
          expiryLabel: expiry.label,
          totalCollected: collected,
          remainingAmount,
          percentageCollected,
          collectionCount: Number(collectionCount),
        };
      });
      return { items, totalCount, currentPage, totalPages, pageSize };
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
  durationDays?: number | null;
  dailyInstallmentPaise?: number | null;
  installmentFrequency: Loan['installmentFrequency'];
  notes?: string | null;
}) {
  assertDbConfigured();
  const newId = randomUUID();
  const now = new Date();
  const normalizedDuration = data.durationDays !== undefined && data.durationDays !== null ? Math.max(1, Math.round(Number(data.durationDays))) : null;
  const expectedEndDate = normalizedDuration ? addDaysToDateString(data.loanDate, normalizedDuration) : null;

  if (isDbConfigured()) {
    try {
      await db.insert(loans).values({
        id: newId,
        personId: data.personId,
        loanAmount: data.loanAmountPaise,
        loanDate: data.loanDate,
        durationDays: normalizedDuration,
        expectedEndDate,
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
        durationDays: normalizedDuration,
        expectedEndDate,
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
  durationDays?: number | null;
}) {
  assertDbConfigured();
  if (data.installmentPaise !== null && data.installmentPaise <= 0) {
    throw new Error('Installment amount must be greater than ₹0.');
  }

  try {
    const [existingLoan] = await db.select().from(loans).where(eq(loans.id, data.loanId));
    if (!existingLoan) throw new Error('Loan not found.');

    const normalizedDuration =
      data.durationDays !== undefined && data.durationDays !== null
        ? Math.max(1, Math.round(Number(data.durationDays)))
        : existingLoan.durationDays ?? null;
    const updatedEndDate = normalizedDuration
      ? addDaysToDateString(existingLoan.loanDate, normalizedDuration)
      : existingLoan.expectedEndDate;

    const now = new Date();
    await db
      .update(loans)
      .set({
        durationDays: normalizedDuration,
        expectedEndDate: updatedEndDate,
        dailyInstallment: data.installmentPaise,
        installmentFrequency: data.installmentFrequency,
        updatedAt: now,
      })
      .where(eq(loans.id, data.loanId));

    return {
      loanId: data.loanId,
      durationDays: normalizedDuration,
      expectedEndDate: updatedEndDate,
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
