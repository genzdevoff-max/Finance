import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { getTodayCollections } from './collections.service';
import { readLocalDb } from '@/lib/storage/local-store';
import { db, people, loans, collections, isDbConfigured } from '@/lib/db';
import { gte, lte, and } from 'drizzle-orm';

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
 * Centrally calculates all metrics required for the main finance dashboard.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  if (isDbConfigured()) {
    try {
      const allLoans = await db.select().from(loans);
      const allCols = await db.select().from(collections);
      const allPeople = await db.select().from(people);

      const totalLent = allLoans.reduce((sum, l) => sum + Number(l.loanAmount), 0);
      const totalCollected = allCols.reduce((sum, c) => sum + Number(c.amount), 0);
      const totalOutstanding = Math.max(0, totalLent - totalCollected);

      const collectedThisWeek = allCols
        .filter((c) => {
          const d = new Date(c.collectedAt);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((sum, c) => sum + Number(c.amount), 0);

      const collectedThisMonth = allCols
        .filter((c) => {
          const d = new Date(c.collectedAt);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, c) => sum + Number(c.amount), 0);

      let activeLoansCount = 0;
      let completedLoansCount = 0;
      for (const l of allLoans) {
        if (l.status === 'ACTIVE') activeLoansCount++;
        else completedLoansCount++;
      }

      const todayCollections = await getTodayCollections();
      const collectedToday = todayCollections.totalCollectedToday;

      const outstandingPeopleList = [];

      for (const person of allPeople) {
        const pLoans = allLoans.filter((l) => l.personId === person.id);
        if (pLoans.length === 0) continue;

        const pLent = pLoans.reduce((sum, l) => sum + Number(l.loanAmount), 0);
        const pCols = allCols.filter((c) => c.personId === person.id);
        const pCollected = pCols.reduce((sum, c) => sum + Number(c.amount), 0);
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
    } catch (err) {
      console.warn('Database query failed in getDashboardSummary, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();

  // 1. Total Lent
  const totalLent = local.loans.reduce((sum, l) => sum + l.loanAmount, 0);

  // 2. Total Collected
  const totalCollected = local.collections.reduce((sum, c) => sum + c.amount, 0);
  const totalOutstanding = Math.max(0, totalLent - totalCollected);

  // 3. Collected This Week
  const collectedThisWeek = local.collections
    .filter((c) => {
      const d = new Date(c.collectedAt);
      return d >= weekStart && d <= weekEnd;
    })
    .reduce((sum, c) => sum + c.amount, 0);

  // 4. Collected This Month
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
