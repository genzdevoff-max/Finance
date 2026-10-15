import { getTodayCollections, getCollectionsHistory } from './collections.service';
import {
  db,
  people,
  loans,
  collections,
  isDbConfigured,
  assertDbConfigured,
  ensureDbInitialized,
} from '@/lib/db';
import { and, asc, desc, eq, gte, gt, lte, sql } from 'drizzle-orm';
import { endOfDay, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import {
  addDaysToDateString,
  getRemainingDaysForDate,
  getTodayDateString,
  LOAN_EXPIRY_ALERT_DAYS,
} from '@/lib/utils/date';

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
  investedToday: number; // in paise
  investedThisWeek: number; // in paise
  investedThisMonth: number; // in paise
  investedThisYear: number; // in paise
  todayInvestments: {
    id: string;
    personId: string;
    personName: string;
    amount: number;
    loanDate: string;
  }[];
  todayInvestmentsCount: number;
  activeLoansCount: number;
  completedLoansCount: number;
  activePeopleCount: number;
  todayCollections: Awaited<ReturnType<typeof getTodayCollections>>;
  weekCollections: CollectionHistoryPeriod;
  monthCollections: CollectionHistoryPeriod;
  outstandingPeople: {
    id: string;
    fullName: string;
    tamilName: string | null;
    phone: string | null;
    totalOutstanding: number; // in paise
    activeLoansCount: number;
  }[];
  loanDueNotifications: Awaited<ReturnType<typeof getLoanDueNotificationsSummary>>;
}

type LoanDueNotification = {
  id: string;
  loanId: string;
  personId: string;
  personName: string;
  tamilName: string | null;
  loanAmount: number;
  remainingAmount: number;
  expectedEndDate: string;
  daysUntilDue: number;
};

type LoanDueCategory = 'overdue' | 'dueToday' | 'dueTomorrow' | 'dueSoon';

interface LoanDueNotificationGroup {
  count: number;
  totalRemaining: number;
  items: LoanDueNotification[];
}

interface LoanDueNotificationsSummary {
  totalCount: number;
  overdue: LoanDueNotificationGroup;
  dueToday: LoanDueNotificationGroup;
  dueTomorrow: LoanDueNotificationGroup;
  dueSoon: LoanDueNotificationGroup;
}

function createDueLoansQuery(alertWindowEndDate: string) {
  const remainingAmount = sql<number>`
    GREATEST(0, ${loans.loanAmount} - COALESCE(SUM(${collections.amount}), 0))
  `;

  return db
    .select({
      loanId: sql<string>`${loans.id}`.as('loan_id'),
      personId: sql<string>`${people.id}`.as('person_id'),
      personName: sql<string>`${people.fullName}`.as('person_name'),
      tamilName: sql<string | null>`${people.tamilName}`.as('tamil_name'),
      loanAmount: sql<number>`${loans.loanAmount}`.as('loan_amount'),
      remainingAmount: remainingAmount.as('remaining_amount'),
      expectedEndDate: sql<string | null>`${loans.expectedEndDate}`.as(
        'expected_end_date'
      ),
    })
    .from(loans)
    .innerJoin(people, eq(people.id, loans.personId))
    .leftJoin(collections, eq(collections.loanId, loans.id))
    .where(
      and(
        eq(loans.status, 'ACTIVE'),
        lte(loans.expectedEndDate, alertWindowEndDate)
      )
    )
    .groupBy(
      loans.id,
      people.id,
      people.fullName,
      people.tamilName,
      loans.loanAmount,
      loans.expectedEndDate
    )
    .having(gt(remainingAmount, 0))
    .as('due_loans');
}

function mapDueLoan(item: {
  loanId: string;
  personId: string;
  personName: string;
  tamilName: string | null;
  loanAmount: number;
  remainingAmount: number;
  expectedEndDate: string | null;
}, todayDate: string): LoanDueNotification {
  return {
    id: item.loanId,
    loanId: item.loanId,
    personId: item.personId,
    personName: item.personName,
    tamilName: item.tamilName,
    loanAmount: Number(item.loanAmount),
    remainingAmount: Number(item.remainingAmount),
    expectedEndDate: item.expectedEndDate || todayDate,
    daysUntilDue: getRemainingDaysForDate(item.expectedEndDate, new Date()),
  };
}

function getDueCategoryExpression(
  dueLoans: ReturnType<typeof createDueLoansQuery>,
  today: string
) {
  const tomorrow = addDaysToDateString(today, 1) || today;
  const dayAfterWindow =
    addDaysToDateString(today, LOAN_EXPIRY_ALERT_DAYS) || today;
  return sql<LoanDueCategory | 'outsideWindow'>`
    CASE
      WHEN ${dueLoans.expectedEndDate} < ${today} THEN 'overdue'
      WHEN ${dueLoans.expectedEndDate} = ${today} THEN 'dueToday'
      WHEN ${dueLoans.expectedEndDate} = ${tomorrow} THEN 'dueTomorrow'
      WHEN ${dueLoans.expectedEndDate} <= ${dayAfterWindow} THEN 'dueSoon'
      ELSE 'outsideWindow'
    END
  `;
}

function emptyDueGroup(): LoanDueNotificationGroup {
  return { count: 0, totalRemaining: 0, items: [] };
}

export async function getLoanDueNotificationsSummary(): Promise<LoanDueNotificationsSummary> {
  assertDbConfigured();
  await ensureDbInitialized();

  const todayDate = getTodayDateString();
  const alertWindowEndDate =
    addDaysToDateString(todayDate, LOAN_EXPIRY_ALERT_DAYS) || todayDate;
  const dueLoans = createDueLoansQuery(alertWindowEndDate);
  const category = getDueCategoryExpression(dueLoans, todayDate);
  const tomorrow = addDaysToDateString(todayDate, 1) || todayDate;
  const dayAfterWindow =
    addDaysToDateString(todayDate, LOAN_EXPIRY_ALERT_DAYS) || todayDate;
  const rankedDueLoans = db
    .select({
      loanId: sql<string>`${dueLoans.loanId}`.as('loan_id'),
      personId: sql<string>`${dueLoans.personId}`.as('person_id'),
      personName: sql<string>`${dueLoans.personName}`.as('person_name'),
      tamilName: sql<string | null>`${dueLoans.tamilName}`.as('tamil_name'),
      loanAmount: sql<number>`${dueLoans.loanAmount}`.as('loan_amount'),
      remainingAmount: sql<number>`${dueLoans.remainingAmount}`.as(
        'remaining_amount'
      ),
      expectedEndDate: sql<string | null>`${dueLoans.expectedEndDate}`.as(
        'expected_end_date'
      ),
      category: category.as('category'),
      rowNumber: sql<number>`
        ROW_NUMBER() OVER (
          PARTITION BY ${category}
          ORDER BY ${dueLoans.expectedEndDate}, ${dueLoans.loanId}
        )
      `.as('row_number'),
    })
    .from(dueLoans)
    .as('ranked_due_loans');

  try {
    const [summaryRows, topRows] = await Promise.all([
      db
        .select({
          overdueCount: sql<number>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} < ${todayDate} THEN 1 ELSE 0 END), 0)`,
          overdueRemaining: sql<string>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} < ${todayDate} THEN ${dueLoans.remainingAmount} ELSE 0 END), 0)`,
          dueTodayCount: sql<number>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} = ${todayDate} THEN 1 ELSE 0 END), 0)`,
          dueTodayRemaining: sql<string>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} = ${todayDate} THEN ${dueLoans.remainingAmount} ELSE 0 END), 0)`,
          dueTomorrowCount: sql<number>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} = ${tomorrow} THEN 1 ELSE 0 END), 0)`,
          dueTomorrowRemaining: sql<string>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} = ${tomorrow} THEN ${dueLoans.remainingAmount} ELSE 0 END), 0)`,
          dueSoonCount: sql<number>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} > ${tomorrow} AND ${dueLoans.expectedEndDate} <= ${dayAfterWindow} THEN 1 ELSE 0 END), 0)`,
          dueSoonRemaining: sql<string>`COALESCE(SUM(CASE WHEN ${dueLoans.expectedEndDate} > ${tomorrow} AND ${dueLoans.expectedEndDate} <= ${dayAfterWindow} THEN ${dueLoans.remainingAmount} ELSE 0 END), 0)`,
        })
        .from(dueLoans),
      db
        .select({
          loanId: rankedDueLoans.loanId,
          personId: rankedDueLoans.personId,
          personName: rankedDueLoans.personName,
          tamilName: rankedDueLoans.tamilName,
          loanAmount: rankedDueLoans.loanAmount,
          remainingAmount: rankedDueLoans.remainingAmount,
          expectedEndDate: rankedDueLoans.expectedEndDate,
          category: rankedDueLoans.category,
        })
        .from(rankedDueLoans)
        .where(lte(rankedDueLoans.rowNumber, 3))
        .orderBy(rankedDueLoans.expectedEndDate, rankedDueLoans.loanId),
    ]);
    const result: LoanDueNotificationsSummary = {
      totalCount: 0,
      overdue: emptyDueGroup(),
      dueToday: emptyDueGroup(),
      dueTomorrow: emptyDueGroup(),
      dueSoon: emptyDueGroup(),
    };

    const summary = summaryRows[0];
    result.overdue.count = Number(summary?.overdueCount ?? 0);
    result.overdue.totalRemaining = Number(summary?.overdueRemaining ?? 0);
    result.dueToday.count = Number(summary?.dueTodayCount ?? 0);
    result.dueToday.totalRemaining = Number(summary?.dueTodayRemaining ?? 0);
    result.dueTomorrow.count = Number(summary?.dueTomorrowCount ?? 0);
    result.dueTomorrow.totalRemaining = Number(summary?.dueTomorrowRemaining ?? 0);
    result.dueSoon.count = Number(summary?.dueSoonCount ?? 0);
    result.dueSoon.totalRemaining = Number(summary?.dueSoonRemaining ?? 0);
    result.totalCount =
      result.overdue.count +
      result.dueToday.count +
      result.dueTomorrow.count +
      result.dueSoon.count;

    for (const row of topRows) {
      if (row.category === 'outsideWindow') continue;
      result[row.category].items.push(mapDueLoan(row, todayDate));
    }

    return result;
  } catch (err) {
    console.error('Database query failed in getLoanDueNotificationsSummary:', err);
    throw err;
  }
}

export async function getLoanDueNotifications(page = 1, pageSize = 50) {
  assertDbConfigured();
  await ensureDbInitialized();

  const todayDate = getTodayDateString();
  const alertWindowEndDate =
    addDaysToDateString(todayDate, LOAN_EXPIRY_ALERT_DAYS) || todayDate;
  const dueLoans = createDueLoansQuery(alertWindowEndDate);
  const requestedPage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));

  try {
    const [countRows, pageRows] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(dueLoans),
      db
        .select()
        .from(dueLoans)
        .orderBy(asc(dueLoans.expectedEndDate), asc(dueLoans.loanId))
        .limit(safePageSize)
        .offset((requestedPage - 1) * safePageSize),
    ]);
    const totalCount = Number(countRows[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const rows =
      currentPage === requestedPage
        ? pageRows
        : await db
            .select()
            .from(dueLoans)
            .orderBy(asc(dueLoans.expectedEndDate), asc(dueLoans.loanId))
            .limit(safePageSize)
            .offset((currentPage - 1) * safePageSize);

    return {
      items: rows.map((row) => mapDueLoan(row, todayDate)),
      totalCount,
      currentPage,
      totalPages,
      pageSize: safePageSize,
    };
  } catch (err) {
    console.error('Database query failed in getLoanDueNotifications:', err);
    throw err;
  }
}

/**
 * Centrally calculates all metrics required for the main finance dashboard.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  assertDbConfigured();
  await ensureDbInitialized();

  if (isDbConfigured()) {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const todayDate = getTodayDateString();
      const weekStartDate = format(weekStart, 'yyyy-MM-dd');
      const monthStartDate = format(monthStart, 'yyyy-MM-dd');
      const yearStartDate = format(yearStart, 'yyyy-MM-dd');
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
      const investmentSummaryQuery = db
        .select({
          today: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} = ${todayDate} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
          week: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} >= ${weekStartDate} AND ${loans.loanDate} <= ${todayDate} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
          month: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} >= ${monthStartDate} AND ${loans.loanDate} <= ${todayDate} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
          year: sql<string>`COALESCE(SUM(CASE WHEN ${loans.loanDate} >= ${yearStartDate} AND ${loans.loanDate} <= ${todayDate} THEN ${loans.loanAmount} ELSE 0 END), 0)`,
          todayCount: sql<number>`COALESCE(SUM(CASE WHEN ${loans.loanDate} = ${todayDate} THEN 1 ELSE 0 END), 0)`,
        })
        .from(loans);
      const todayInvestmentsQuery = db
        .select({
          id: loans.id,
          personId: people.id,
          personName: people.fullName,
          amount: loans.loanAmount,
          loanDate: loans.loanDate,
        })
        .from(loans)
        .innerJoin(people, eq(people.id, loans.personId))
        .where(eq(loans.loanDate, todayDate))
        .orderBy(desc(loans.createdAt), desc(loans.id))
        .limit(25);
      const outstandingBalance = sql<number>`
        ${loanTotals.totalLent} - COALESCE(${collectionTotals.totalCollected}, 0)
      `;
      const peopleSummaryQuery = db
        .select({
          id: people.id,
          fullName: people.fullName,
          tamilName: people.tamilName,
          phone: people.phone,
          totalLent: loanTotals.totalLent,
          totalCollected: sql<string>`COALESCE(${collectionTotals.totalCollected}, 0)`,
          activeLoansCount: loanTotals.activeLoansCount,
          totalOutstanding: outstandingBalance,
          outstandingPeopleCount: sql<number>`COUNT(*) OVER()`,
        })
        .from(loanTotals)
        .innerJoin(people, eq(people.id, loanTotals.personId))
        .leftJoin(collectionTotals, eq(collectionTotals.personId, people.id))
        .where(gt(outstandingBalance, 0))
        .orderBy(desc(outstandingBalance), people.fullName, people.id)
        .limit(10);
      const periodRowsQuery = (from: Date, to: Date) => db
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
          personPhone: people.phone,
          loanAmount: sql<string>`COALESCE(${loans.loanAmount}, 0)`,
          loanDate: sql<string>`COALESCE(${loans.loanDate}, '')`,
        })
        .from(collections)
        .leftJoin(people, eq(people.id, collections.personId))
        .leftJoin(loans, eq(loans.id, collections.loanId))
        .where(
          and(
            gte(collections.collectedAt, from),
            lte(collections.collectedAt, to)
          )
        )
        .orderBy(desc(collections.collectedAt), desc(collections.id))
        .limit(25);
      const periodSummaryQuery = db
        .select({
          todayTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.collectedAt} >= ${todayStart} AND ${collections.collectedAt} <= ${todayEnd} THEN ${collections.amount} ELSE 0 END), 0)`,
          todayCount: sql<number>`COALESCE(SUM(CASE WHEN ${collections.collectedAt} >= ${todayStart} AND ${collections.collectedAt} <= ${todayEnd} THEN 1 ELSE 0 END), 0)`,
          weekTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.collectedAt} >= ${weekStart} AND ${collections.collectedAt} <= ${now} THEN ${collections.amount} ELSE 0 END), 0)`,
          weekCount: sql<number>`COALESCE(SUM(CASE WHEN ${collections.collectedAt} >= ${weekStart} AND ${collections.collectedAt} <= ${now} THEN 1 ELSE 0 END), 0)`,
          monthTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.collectedAt} >= ${monthStart} AND ${collections.collectedAt} <= ${now} THEN ${collections.amount} ELSE 0 END), 0)`,
          monthCount: sql<number>`COALESCE(SUM(CASE WHEN ${collections.collectedAt} >= ${monthStart} AND ${collections.collectedAt} <= ${now} THEN 1 ELSE 0 END), 0)`,
        })
        .from(collections)
        .where(
          and(
            gte(collections.collectedAt, earliestPeriodStart),
            lte(collections.collectedAt, todayEnd)
          )
        );

      const [
        loanSummaryRows,
        collectionSummaryRows,
        investmentSummaryRows,
        todayInvestments,
        peopleSummaryRows,
        todayRows,
        weekRows,
        monthRows,
        periodSummaryRows,
        loanDueNotifications,
      ] =
        await Promise.all([
          loanSummaryQuery,
          collectionSummaryQuery,
          investmentSummaryQuery,
          todayInvestmentsQuery,
          peopleSummaryQuery,
          periodRowsQuery(todayStart, todayEnd),
          periodRowsQuery(weekStart, now),
          periodRowsQuery(monthStart, now),
          periodSummaryQuery,
          getLoanDueNotificationsSummary(),
        ]);
      const loanSummary = loanSummaryRows[0];
      const collectionSummary = collectionSummaryRows[0];
      const investmentSummary = investmentSummaryRows[0];
      const totalLent = Number(loanSummary?.totalLent ?? 0);
      const totalCollected = Number(collectionSummary?.totalCollected ?? 0);
      const totalOutstanding = Math.max(0, totalLent - totalCollected);
      const activeLoansCount = Number(loanSummary?.activeLoansCount ?? 0);
      const completedLoansCount = Number(loanSummary?.completedLoansCount ?? 0);

      const mapCollection = (row: (typeof monthRows)[number]) => ({
        id: row.id,
        loanId: row.loanId,
        personId: row.personId,
        amount: Number(row.amount),
        collectedAt: new Date(row.collectedAt),
        notes: row.notes,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        personName: row.personName,
        personPhone: row.personPhone,
        loanAmount: Number(row.loanAmount),
        loanDate: row.loanDate,
      });
      const todayItems = todayRows.map(mapCollection);
      const weekItems = weekRows.map(mapCollection);
      const monthItems = monthRows.map(mapCollection);
      const periodSummary = periodSummaryRows[0];
      const todayCollections = {
        totalCollectedToday: Number(periodSummary?.todayTotal ?? 0),
        count: Number(periodSummary?.todayCount ?? 0),
        items: todayItems,
      };
      const weekCollections = {
        totalCollected: Number(periodSummary?.weekTotal ?? 0),
        count: Number(periodSummary?.weekCount ?? 0),
        items: weekItems,
      };
      const monthCollections = {
        totalCollected: Number(periodSummary?.monthTotal ?? 0),
        count: Number(periodSummary?.monthCount ?? 0),
        items: monthItems,
      };
      const outstandingPeopleList = peopleSummaryRows
        .map((person) => ({
          id: person.id,
          fullName: person.fullName,
          tamilName: person.tamilName,
          phone: person.phone,
          totalOutstanding: Number(person.totalOutstanding),
          activeLoansCount: Number(person.activeLoansCount),
        }));

      const collectedToday = todayCollections.totalCollectedToday;
      const collectedThisWeek = weekCollections.totalCollected;
      const collectedThisMonth = monthCollections.totalCollected;
      const activePeopleCount = Number(peopleSummaryRows[0]?.outstandingPeopleCount ?? 0);

      return {
        totalLent,
        totalCollected,
        totalOutstanding,
        collectedToday,
        collectedThisWeek,
        collectedThisMonth,
        investedToday: Number(investmentSummary?.today ?? 0),
        investedThisWeek: Number(investmentSummary?.week ?? 0),
        investedThisMonth: Number(investmentSummary?.month ?? 0),
        investedThisYear: Number(investmentSummary?.year ?? 0),
        todayInvestments: todayInvestments.map((loan) => ({
          id: loan.id,
          personId: loan.personId,
          personName: loan.personName,
          amount: Number(loan.amount),
          loanDate: loan.loanDate,
        })),
        todayInvestmentsCount: Number(investmentSummary?.todayCount ?? 0),
        activeLoansCount,
        completedLoansCount,
        activePeopleCount,
        todayCollections,
        weekCollections,
        monthCollections,
        outstandingPeople: outstandingPeopleList,
        loanDueNotifications,
      };
    } catch (err) {
      console.error('Database query failed in getDashboardSummary:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}
