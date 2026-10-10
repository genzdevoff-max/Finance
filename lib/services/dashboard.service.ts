import { getTodayCollections, getCollectionsHistory } from './collections.service';
import { db, people, loans, collections, isDbConfigured, assertDbConfigured } from '@/lib/db';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { endOfDay, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

type CollectionHistoryPeriod = Pick<
  Awaited<ReturnType<typeof getCollectionsHistory>>,
  'totalCollected' | 'count' | 'items'
>;

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
  weekCollections: CollectionHistoryPeriod;
  monthCollections: CollectionHistoryPeriod;
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
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const earliestPeriodStart = weekStart < monthStart ? weekStart : monthStart;

      const loanTotals = db
        .select({
          personId: loans.personId,
          totalLent: sql<string>`SUM(${loans.loanAmount})`.as('total_lent'),
          activeLoansCount: sql<string>`SUM(CASE WHEN ${loans.status} = 'ACTIVE' THEN 1 ELSE 0 END)`.as(
            'active_loans_count'
          ),
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

      const loanSummaryQuery = db
        .select({
          totalLent: sql<string>`COALESCE(SUM(${loans.loanAmount}), 0)`,
          activeLoansCount: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} = 'ACTIVE' THEN 1 ELSE 0 END), 0)`,
          completedLoansCount: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'ACTIVE' THEN 1 ELSE 0 END), 0)`,
        })
        .from(loans);
      const collectionSummaryQuery = db
        .select({
          totalCollected: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
        })
        .from(collections);
      const peopleSummaryQuery = db
        .select({
          id: people.id,
          fullName: people.fullName,
          phone: people.phone,
          totalLent: loanTotals.totalLent,
          totalCollected: sql<string>`COALESCE(${collectionTotals.totalCollected}, 0)`,
          activeLoansCount: loanTotals.activeLoansCount,
        })
        .from(loanTotals)
        .innerJoin(people, eq(people.id, loanTotals.personId))
        .leftJoin(collectionTotals, eq(collectionTotals.personId, people.id));
      const periodRowsQuery = db
        .select({
          id: collections.id,
          loanId: collections.loanId,
          personId: collections.personId,
          amount: collections.amount,
          collectedAt: collections.collectedAt,
          notes: collections.notes,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
          personName: sql<string>`COALESCE(${people.fullName}, 'Contact')`,
          loanAmount: sql<string>`COALESCE(${loans.loanAmount}, 0)`,
          loanDate: sql<string>`COALESCE(${loans.loanDate}, '')`,
        })
        .from(collections)
        .leftJoin(people, eq(people.id, collections.personId))
        .leftJoin(loans, eq(loans.id, collections.loanId))
        .where(
          and(
            gte(collections.collectedAt, earliestPeriodStart),
            lte(collections.collectedAt, todayEnd)
          )
        )
        .orderBy(desc(collections.collectedAt), desc(collections.id));

      const [loanSummaryRows, collectionSummaryRows, peopleSummaryRows, periodRows] =
        await Promise.all([
          loanSummaryQuery,
          collectionSummaryQuery,
          peopleSummaryQuery,
          periodRowsQuery,
        ]);
      const loanSummary = loanSummaryRows[0];
      const collectionSummary = collectionSummaryRows[0];
      const totalLent = Number(loanSummary?.totalLent ?? 0);
      const totalCollected = Number(collectionSummary?.totalCollected ?? 0);
      const totalOutstanding = Math.max(0, totalLent - totalCollected);
      const activeLoansCount = Number(loanSummary?.activeLoansCount ?? 0);
      const completedLoansCount = Number(loanSummary?.completedLoansCount ?? 0);

      const mapCollection = (row: (typeof periodRows)[number]) => ({
        id: row.id,
        loanId: row.loanId,
        personId: row.personId,
        amount: Number(row.amount),
        collectedAt: new Date(row.collectedAt),
        notes: row.notes,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        personName: row.personName,
        loanAmount: Number(row.loanAmount),
        loanDate: row.loanDate,
      });
      const todayRows = periodRows.filter(
        (row) => row.collectedAt >= todayStart && row.collectedAt <= todayEnd
      );
      const weekRows = periodRows.filter(
        (row) => row.collectedAt >= weekStart && row.collectedAt <= now
      );
      const monthRows = periodRows.filter(
        (row) => row.collectedAt >= monthStart && row.collectedAt <= now
      );
      const todayItems = todayRows.map(mapCollection);
      const weekItems = weekRows.map(mapCollection);
      const monthItems = monthRows.map(mapCollection);
      const todayCollections = {
        totalCollectedToday: todayItems.reduce((sum, item) => sum + item.amount, 0),
        count: todayItems.length,
        items: todayItems,
      };
      const weekCollections = {
        totalCollected: weekItems.reduce((sum, item) => sum + item.amount, 0),
        count: weekItems.length,
        items: weekItems,
      };
      const monthCollections = {
        totalCollected: monthItems.reduce((sum, item) => sum + item.amount, 0),
        count: monthItems.length,
        items: monthItems,
      };
      const outstandingPeopleList = peopleSummaryRows
        .map((person) => ({
          id: person.id,
          fullName: person.fullName,
          phone: person.phone,
          totalOutstanding: Math.max(
            0,
            Number(person.totalLent) - Number(person.totalCollected)
          ),
          activeLoansCount: Number(person.activeLoansCount),
        }))
        .filter((person) => person.totalOutstanding > 0)
        .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
      const collectedToday = todayCollections.totalCollectedToday;
      const collectedThisWeek = weekCollections.totalCollected;
      const collectedThisMonth = monthCollections.totalCollected;
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
