import { eq, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { collections, loans, people } from '@/lib/db/schema';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { getTodayCollections } from './collections.service';
import { isLocalMode, readLocalDb } from '@/lib/storage/local-store';

export interface DashboardSummary {
  totalLent: number; // in paise
  totalCollected: number; // in paise
  totalOutstanding: number; // in paise
  collectedToday: number; // in paise
  collectedThisWeek: number; // in paise
  collectedThisMonth: number; // in paise
  activeLoansCount: number;
  completedLoansCount: number;
  activePeopleCount: number;
  todayCollections: Awaited<ReturnType<typeof getTodayCollections>>;
  outstandingPeople: {
    id: string;
    fullName: string;
    phone: string | null;
    totalOutstanding: number; // in paise
    activeLoansCount: number;
  }[];
}

/**
 * Centrally calculates all metrics required for the main dashboard.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();

  if (isLocalMode()) {
    const local = readLocalDb();

    // 1. Total Lent
    const totalLent = local.loans.reduce((sum, l) => sum + l.loanAmount, 0);

    // 2. Total Collected
    const totalCollected = local.collections.reduce((sum, c) => sum + c.amount, 0);
    const totalOutstanding = Math.max(0, totalLent - totalCollected);

    // 3. Collected This Week
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const collectedThisWeek = local.collections
      .filter((c) => {
        const d = new Date(c.collectedAt);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    // 4. Collected This Month
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const collectedThisMonth = local.collections
      .filter((c) => {
        const d = new Date(c.collectedAt);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    // 5. Active and Completed count
    let activeLoansCount = 0;
    let completedLoansCount = 0;
    for (const l of local.loans) {
      if (l.status === 'ACTIVE') activeLoansCount++;
      else completedLoansCount++;
    }

    // 6. Today's collections
    const todayCollections = await getTodayCollections();
    const collectedToday = todayCollections.totalCollectedToday;

    // 7. Outstanding People
    const outstandingPeopleList = [];

    for (const person of local.people) {
      const pLoans = local.loans.filter((l) => l.personId === person.id);
      if (pLoans.length === 0) continue;

      const pLent = pLoans.reduce((sum, l) => sum + l.loanAmount, 0);
      const pCols = local.collections.filter((c) => c.personId === person.id);
      const pCollected = pCols.reduce((sum, c) => sum + c.amount, 0);
      const personOutstanding = Math.max(0, pLent - pCollected);
      const activeLoans = pLoans.filter((l) => l.status === 'ACTIVE').length;

      if (personOutstanding > 0) {
        outstandingPeopleList.push({
          id: person.id,
          fullName: person.fullName,
          phone: person.phone,
          totalOutstanding: personOutstanding,
          activeLoansCount: activeLoans,
        });
      }
    }

    outstandingPeopleList.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    const activePeopleCount = outstandingPeopleList.length;

    return {
      totalLent,
      totalCollected,
      totalOutstanding,
      collectedToday,
      collectedThisWeek,
      collectedThisMonth,
      activeLoansCount,
      completedLoansCount,
      activePeopleCount,
      todayCollections,
      outstandingPeople: outstandingPeopleList,
    };
  }

  // PostgreSQL Mode
  const lentResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${loans.loanAmount}), 0)`,
    })
    .from(loans);
  const totalLent = Number(lentResult[0]?.total ?? 0);

  const collectedAllTimeResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
    })
    .from(collections);
  const totalCollected = Number(collectedAllTimeResult[0]?.total ?? 0);

  const totalOutstanding = Math.max(0, totalLent - totalCollected);

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekColResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
    })
    .from(collections)
    .where(and(gte(collections.collectedAt, weekStart), lte(collections.collectedAt, weekEnd)));
  const collectedThisWeek = Number(weekColResult[0]?.total ?? 0);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthColResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
    })
    .from(collections)
    .where(and(gte(collections.collectedAt, monthStart), lte(collections.collectedAt, monthEnd)));
  const collectedThisMonth = Number(monthColResult[0]?.total ?? 0);

  const allLoans = await db
    .select({
      id: loans.id,
      personId: loans.personId,
      status: loans.status,
      loanAmount: loans.loanAmount,
    })
    .from(loans);

  let activeLoansCount = 0;
  let completedLoansCount = 0;
  for (const l of allLoans) {
    if (l.status === 'ACTIVE') {
      activeLoansCount++;
    } else {
      completedLoansCount++;
    }
  }

  const todayCollections = await getTodayCollections();
  const collectedToday = todayCollections.totalCollectedToday;

  const allPeople = await db.select().from(people);
  const outstandingPeopleList = [];

  for (const person of allPeople) {
    const personLoans = allLoans.filter((l) => l.personId === person.id);
    if (personLoans.length === 0) continue;

    const personLent = personLoans.reduce((sum, l) => sum + l.loanAmount, 0);

    const personColResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
      })
      .from(collections)
      .where(eq(collections.personId, person.id));

    const personCollected = Number(personColResult[0]?.total ?? 0);
    const personOutstanding = Math.max(0, personLent - personCollected);
    const activeLoans = personLoans.filter((l) => l.status === 'ACTIVE').length;

    if (personOutstanding > 0) {
      outstandingPeopleList.push({
        id: person.id,
        fullName: person.fullName,
        phone: person.phone,
        totalOutstanding: personOutstanding,
        activeLoansCount: activeLoans,
      });
    }
  }

  outstandingPeopleList.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  const activePeopleCount = outstandingPeopleList.length;

  return {
    totalLent,
    totalCollected,
    totalOutstanding,
    collectedToday,
    collectedThisWeek,
    collectedThisMonth,
    activeLoansCount,
    completedLoansCount,
    activePeopleCount,
    todayCollections,
    outstandingPeople: outstandingPeopleList,
  };
}
