import { getTodayCollections, getCollectionsHistory } from './collections.service';
import { db, people, loans, collections, isDbConfigured, assertDbConfigured } from '@/lib/db';

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
  weekCollections: Awaited<ReturnType<typeof getCollectionsHistory>>;
  monthCollections: Awaited<ReturnType<typeof getCollectionsHistory>>;
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
  assertDbConfigured();

  if (isDbConfigured()) {
    try {
      const allLoans = await db.select().from(loans);
      const allCols = await db.select().from(collections);
      const allPeople = await db.select().from(people);

      const totalLent = allLoans.reduce((sum, l) => sum + Number(l.loanAmount), 0);
      const totalCollected = allCols.reduce((sum, c) => sum + Number(c.amount), 0);
      const totalOutstanding = Math.max(0, totalLent - totalCollected);

      let activeLoansCount = 0;
      let completedLoansCount = 0;
      for (const l of allLoans) {
        if (l.status === 'ACTIVE') activeLoansCount++;
        else completedLoansCount++;
      }

      const [todayCollections, weekCollections, monthCollections] = await Promise.all([
        getTodayCollections(),
        getCollectionsHistory({ range: 'week' }),
        getCollectionsHistory({ range: 'month' }),
      ]);
      const collectedToday = todayCollections.totalCollectedToday;
      const collectedThisWeek = weekCollections.totalCollected;
      const collectedThisMonth = monthCollections.totalCollected;

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
        weekCollections,
        monthCollections,
        outstandingPeople: outstandingPeopleList,
      };
    } catch (err) {
      console.error('Database query failed in getDashboardSummary:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}
