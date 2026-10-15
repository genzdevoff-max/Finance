import { getLoansByPersonId, type LoanWithFinancials } from './loans.service';
import type { Person } from '@/lib/db/schema';
import {
  db,
  people,
  loans,
  collections,
  isDbConfigured,
  assertDbConfigured,
  ensureDbInitialized,
} from '@/lib/db';
import { asc, eq, inArray, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { addDaysToDateString, getTodayDateString } from '@/lib/utils/date';

export interface PersonWithFinancials extends Person {
  totalBorrowed: number; // in paise
  totalCollected: number; // in paise
  totalOutstanding: number; // in paise
  activeLoansCount: number;
  completedLoansCount: number;
  totalLoansCount: number;
}

export interface PersonDetail extends PersonWithFinancials {
  loans: LoanWithFinancials[];
  loanPage: number;
  loanTotalPages: number;
  loanPageSize: number;
  investedToday: number;
  investedThisWeek: number;
  investedThisMonth: number;
  investedThisYear: number;
  dueTodayLoansCount: number;
  endingSoonLoansCount: number;
  overdueLoansCount: number;
}

/**
 * Gets all people with computed financial metrics and optional search filtering.
 */
export async function getPeopleList(searchQuery?: string): Promise<PersonWithFinancials[]> {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const loanTotals = db
        .select({
          personId: loans.personId,
          totalBorrowed: sql<string>`SUM(${loans.loanAmount})`.as('total_borrowed'),
          activeLoansCount: sql<string>`SUM(CASE WHEN ${loans.status} = 'ACTIVE' THEN 1 ELSE 0 END)`.as(
            'active_loans_count'
          ),
          completedLoansCount: sql<string>`SUM(CASE WHEN ${loans.status} != 'ACTIVE' THEN 1 ELSE 0 END)`.as(
            'completed_loans_count'
          ),
          totalLoansCount: sql<string>`COUNT(${loans.id})`.as('total_loans_count'),
        })
        .from(loans)
        .groupBy(loans.personId)
        .as('loan_totals');
      const collectionTotals = db
        .select({
          personId: collections.personId,
          totalCollected: sql<string>`SUM(${collections.amount})`.as('total_collected'),
        })
        .from(collections)
        .groupBy(collections.personId)
        .as('collection_totals');

      const query = db
        .select({
          id: people.id,
          fullName: people.fullName,
          tamilName: people.tamilName,
          phone: people.phone,
          work: people.work,
          address: people.address,
          notes: people.notes,
          createdAt: people.createdAt,
          updatedAt: people.updatedAt,
          totalBorrowed: sql<string>`COALESCE(${loanTotals.totalBorrowed}, 0)`,
          totalCollected: sql<string>`COALESCE(${collectionTotals.totalCollected}, 0)`,
          activeLoansCount: sql<string>`COALESCE(${loanTotals.activeLoansCount}, 0)`,
          completedLoansCount: sql<string>`COALESCE(${loanTotals.completedLoansCount}, 0)`,
          totalLoansCount: sql<string>`COALESCE(${loanTotals.totalLoansCount}, 0)`,
        })
        .from(people)
        .leftJoin(loanTotals, eq(loanTotals.personId, people.id))
        .leftJoin(collectionTotals, eq(collectionTotals.personId, people.id));

      const term = searchQuery?.trim();
      const allPeople = term
        ? await query
            .where(
              or(
                sql`LOWER(${people.fullName}) LIKE ${`%${term.toLowerCase()}%`}`,
                sql`LOWER(${people.phone}) LIKE ${`%${term.toLowerCase()}%`}`
              )
            )
            .orderBy(asc(people.fullName))
        : await query.orderBy(asc(people.fullName));
      return allPeople.map((person) => {
        const totalBorrowed = Number(person.totalBorrowed);
        const totalCollected = Number(person.totalCollected);
        return {
          ...person,
          createdAt: new Date(person.createdAt),
          updatedAt: new Date(person.updatedAt),
          totalBorrowed,
          totalCollected,
          totalOutstanding: Math.max(0, totalBorrowed - totalCollected),
          activeLoansCount: Number(person.activeLoansCount),
          completedLoansCount: Number(person.completedLoansCount),
          totalLoansCount: Number(person.totalLoansCount),
        };
      });
    } catch (err) {
      console.error('Database query failed in getPeopleList:', err);
      throw err;
    }

  }

  throw new Error('DATABASE_URL is not configured.');
}

export async function getPeopleOptions(): Promise<{ id: string; fullName: string }[]> {
  assertDbConfigured();
  await ensureDbInitialized();

  try {
    return await db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .orderBy(asc(people.fullName), asc(people.id));
  } catch (err) {
    console.error('Database query failed in getPeopleOptions:', err);
    throw err;
  }
}

export async function searchPeopleOptions(
  searchQuery: string
): Promise<{ id: string; fullName: string; phone: string | null }[]> {
  assertDbConfigured();
  await ensureDbInitialized();

  const term = searchQuery.trim().toLowerCase();
  if (term.length < 2) return [];

  try {
    return await db
      .select({ id: people.id, fullName: people.fullName, phone: people.phone })
      .from(people)
      .where(
        or(
          sql`LOWER(${people.fullName}) LIKE ${`%${term}%`}`,
          sql`LOWER(${people.phone}) LIKE ${`%${term}%`}`
        )
      )
      .orderBy(asc(people.fullName), asc(people.id))
      .limit(10);
  } catch (err) {
    console.error('Database query failed in searchPeopleOptions:', err);
    throw err;
  }
}

export async function getPersonOptionById(
  id: string
): Promise<{ id: string; fullName: string } | null> {
  assertDbConfigured();
  await ensureDbInitialized();

  try {
    const [person] = await db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(eq(people.id, id))
      .limit(1);
    return person ?? null;
  } catch (err) {
    console.error('Database query failed in getPersonOptionById:', err);
    throw err;
  }
}

export async function getPeopleListPage(
  searchQuery: string | undefined,
  page: number,
  pageSize: number
): Promise<{ items: PersonWithFinancials[]; totalCount: number; currentPage: number }> {
  assertDbConfigured();
  if (!isDbConfigured()) throw new Error('DATABASE_URL is not configured.');
  await ensureDbInitialized();

  try {
    const term = searchQuery?.trim();
    const normalizedTerm = term?.toLowerCase();
    const filter = normalizedTerm
      ? or(
          sql`LOWER(${people.fullName}) LIKE ${`%${normalizedTerm}%`}`,
          sql`LOWER(${people.phone}) LIKE ${`%${normalizedTerm}%`}`
        )
      : undefined;
    const requestedPage = Math.max(1, page);
    const [countResult, requestedPagePeople] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(people).where(filter),
      db
        .select()
        .from(people)
        .where(filter)
        .orderBy(asc(people.fullName), asc(people.id))
        .limit(pageSize)
        .offset((requestedPage - 1) * pageSize),
    ]);
    const totalCount = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const pagePeople =
      currentPage === requestedPage
        ? requestedPagePeople
        : await db
            .select()
            .from(people)
            .where(filter)
            .orderBy(asc(people.fullName), asc(people.id))
            .limit(pageSize)
            .offset((currentPage - 1) * pageSize);
    if (pagePeople.length === 0) return { items: [], totalCount, currentPage };

    const personIds = pagePeople.map((person) => person.id);
    const [loanTotals, collectionTotals] = await Promise.all([
      db
        .select({
          personId: loans.personId,
          totalBorrowed: sql<string>`SUM(${loans.loanAmount})`,
          activeLoansCount: sql<string>`SUM(CASE WHEN ${loans.status} = 'ACTIVE' THEN 1 ELSE 0 END)`,
          completedLoansCount: sql<string>`SUM(CASE WHEN ${loans.status} != 'ACTIVE' THEN 1 ELSE 0 END)`,
          totalLoansCount: sql<string>`COUNT(${loans.id})`,
        })
        .from(loans)
        .where(inArray(loans.personId, personIds))
        .groupBy(loans.personId),
      db
        .select({
          personId: collections.personId,
          totalCollected: sql<string>`SUM(${collections.amount})`,
        })
        .from(collections)
        .where(inArray(collections.personId, personIds))
        .groupBy(collections.personId),
    ]);

    const loanTotalsByPerson = new Map(loanTotals.map((totals) => [totals.personId, totals]));
    const collectionTotalsByPerson = new Map(
      collectionTotals.map((totals) => [totals.personId, Number(totals.totalCollected)])
    );
    return {
      totalCount,
      currentPage,
      items: pagePeople.map((person) => {
        const totals = loanTotalsByPerson.get(person.id);
        const totalBorrowed = Number(totals?.totalBorrowed ?? 0);
        const totalCollected = collectionTotalsByPerson.get(person.id) ?? 0;
        return {
          ...person,
          createdAt: new Date(person.createdAt),
          updatedAt: new Date(person.updatedAt),
          totalBorrowed,
          totalCollected,
          totalOutstanding: Math.max(0, totalBorrowed - totalCollected),
          activeLoansCount: Number(totals?.activeLoansCount ?? 0),
          completedLoansCount: Number(totals?.completedLoansCount ?? 0),
          totalLoansCount: Number(totals?.totalLoansCount ?? 0),
        };
      }),
    };
  } catch (error) {
    console.error('Database query failed in getPeopleListPage:', error);
    throw error;
  }
}

/**
 * Gets a single person by ID with full financial metrics and loans list.
 */
export async function getPersonById(id: string, loanPage = 1): Promise<PersonDetail | null> {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const [personRecord] = await db
        .select()
        .from(people)
        .where(eq(people.id, id));

      if (personRecord) {
        const today = getTodayDateString();
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const tomorrow = addDaysToDateString(today, 1) || today;
        const weekEnd = addDaysToDateString(today, 7) || today;
        const collectionTotals = db
          .select({
            loanId: collections.loanId,
            totalCollected: sql<string>`SUM(${collections.amount})`.as('total_collected'),
          })
          .from(collections)
          .innerJoin(loans, eq(loans.id, collections.loanId))
          .where(eq(loans.personId, id))
          .groupBy(collections.loanId)
          .as('person_collection_totals');
        const expectedEndDate = sql<string | null>`
          COALESCE(
            ${loans.expectedEndDate},
            DATE_FORMAT(
              DATE_ADD(
                STR_TO_DATE(${loans.loanDate}, '%Y-%m-%d'),
                INTERVAL COALESCE(${loans.durationDays}, 0) DAY
              ),
              '%Y-%m-%d'
            )
          )
        `;
        const remainingAmount = sql<number>`
          GREATEST(0, ${loans.loanAmount} - COALESCE(${collectionTotals.totalCollected}, 0))
        `;
        const [summaryRows, loanPageResult] = await Promise.all([
          db
            .select({
              totalBorrowed: sql<string>`COALESCE(SUM(${loans.loanAmount}), 0)`,
              totalCollected: sql<string>`COALESCE(SUM(COALESCE(${collectionTotals.totalCollected}, 0)), 0)`,
              totalLoansCount: sql<number>`COUNT(*)`,
              activeLoansCount: sql<number>`COALESCE(SUM(CASE WHEN ${loans.status} = 'ACTIVE' THEN 1 ELSE 0 END), 0)`,
              completedLoansCount: sql<number>`COALESCE(SUM(CASE WHEN ${loans.status} != 'ACTIVE' THEN 1 ELSE 0 END), 0)`,
              investedToday: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} = ${today} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
              investedThisWeek: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} >= ${weekStart} AND ${loans.loanDate} <= ${today} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
              investedThisMonth: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} >= ${monthStart} AND ${loans.loanDate} <= ${today} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
              investedThisYear: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} >= ${yearStart} AND ${loans.loanDate} <= ${today} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
              dueTodayLoansCount: sql<number>`COALESCE(SUM(CASE WHEN ${loans.status} = 'ACTIVE' AND ${expectedEndDate} = ${today} AND ${remainingAmount} > 0 THEN 1 ELSE 0 END), 0)`,
              endingSoonLoansCount: sql<number>`COALESCE(SUM(CASE WHEN ${loans.status} = 'ACTIVE' AND ${expectedEndDate} > ${today} AND ${expectedEndDate} <= ${weekEnd} AND ${remainingAmount} > 0 THEN 1 ELSE 0 END), 0)`,
              overdueLoansCount: sql<number>`COALESCE(SUM(CASE WHEN ${loans.status} = 'ACTIVE' AND ${expectedEndDate} < ${today} AND ${remainingAmount} > 0 THEN 1 ELSE 0 END), 0)`,
            })
            .from(loans)
            .leftJoin(collectionTotals, eq(collectionTotals.loanId, loans.id))
            .where(eq(loans.personId, id)),
          getLoansByPersonId(id, loanPage),
        ]);
        const summary = summaryRows[0];
        const totalBorrowed = Number(summary?.totalBorrowed ?? 0);
        const totalCollected = Number(summary?.totalCollected ?? 0);
        const totalLoansCount = Number(summary?.totalLoansCount ?? 0);

        return {
          id: personRecord.id,
          fullName: personRecord.fullName,
          tamilName: personRecord.tamilName,
          phone: personRecord.phone,
          work: personRecord.work,
          address: personRecord.address,
          notes: personRecord.notes,
          createdAt: new Date(personRecord.createdAt),
          updatedAt: new Date(personRecord.updatedAt),
          totalBorrowed,
          totalCollected,
          totalOutstanding: Math.max(0, totalBorrowed - totalCollected),
          activeLoansCount: Number(summary?.activeLoansCount ?? 0),
          completedLoansCount: Number(summary?.completedLoansCount ?? 0),
          totalLoansCount,
          loans: loanPageResult.items,
          loanPage: loanPageResult.currentPage,
          loanTotalPages: loanPageResult.totalPages,
          loanPageSize: loanPageResult.pageSize,
          investedToday: Number(summary?.investedToday ?? 0),
          investedThisWeek: Number(summary?.investedThisWeek ?? 0),
          investedThisMonth: Number(summary?.investedThisMonth ?? 0),
          investedThisYear: Number(summary?.investedThisYear ?? 0),
          dueTodayLoansCount: Number(summary?.dueTodayLoansCount ?? 0),
          endingSoonLoansCount: Number(summary?.endingSoonLoansCount ?? 0),
          overdueLoansCount: Number(summary?.overdueLoansCount ?? 0),
        };
      }
      return null;
    } catch (err) {
      console.error('Database query failed in getPersonById:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Creates a new person record.
 */
export async function createPerson(data: {
  fullName: string;
  work?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  assertDbConfigured();
  const newId = randomUUID();
  const now = new Date();
  const trimmedName = data.fullName.trim();
  const work = data.work?.trim() || null;
  const phone = data.phone?.trim() || null;
  const address = data.address?.trim() || null;
  const notes = data.notes?.trim() || null;

  if (isDbConfigured()) {
    try {
      await db.insert(people).values({
        id: newId,
        fullName: trimmedName,
        work,
        phone,
        address,
        notes,
      });

      return {
        id: newId,
        fullName: trimmedName,
        work,
        phone,
        address,
        notes,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      console.error('Database insert failed in createPerson:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Updates an existing person record.
 */
export async function updatePerson(
  id: string,
  data: {
    fullName: string;
    work?: string | null;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  }
) {
  assertDbConfigured();
  const now = new Date();
  const trimmedName = data.fullName.trim();
  const work = data.work?.trim() || null;
  const phone = data.phone?.trim() || null;
  const address = data.address?.trim() || null;
  const notes = data.notes?.trim() || null;

  if (isDbConfigured()) {
    try {
      const [existingPerson] = await db.select().from(people).where(eq(people.id, id));
      if (!existingPerson) throw new Error('Person not found');
      await db
        .update(people)
        .set({
          fullName: trimmedName,
          work,
          phone,
          address,
          notes: data.notes === undefined ? existingPerson.notes : notes,
          updatedAt: now,
        })
        .where(eq(people.id, id));

      return {
        id,
        fullName: trimmedName,
        work,
        phone,
        address,
        notes,
        createdAt: new Date(existingPerson.createdAt),
        updatedAt: now,
      };
    } catch (err) {
      console.error('Database update failed in updatePerson:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Deletes a person and cascades all related loans and collections.
 */
export async function deletePerson(id: string) {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const [existingPerson] = await db.select({ id: people.id }).from(people).where(eq(people.id, id));
      if (!existingPerson) throw new Error('Person not found');

      // In MySQL, delete collections and loans first if foreign keys are not cascading automatically
      await db.delete(collections).where(eq(collections.personId, id));
      await db.delete(loans).where(eq(loans.personId, id));
      await db.delete(people).where(eq(people.id, id));
      return true;
    } catch (err) {
      console.error('Database delete failed in deletePerson:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}
