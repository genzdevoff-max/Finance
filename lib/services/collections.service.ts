import { formatRupees } from '@/lib/utils/currency';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  format,
} from 'date-fns';
import type { Collection } from '@/lib/db/schema';
import {
  db,
  people,
  loans,
  collections,
  isDbConfigured,
  assertDbConfigured,
  ensureDbInitialized,
} from '@/lib/db';
import { desc, eq, sql, gte, lte, and, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface CollectionRecordDetail extends Collection {
  personName: string;
  loanAmount: number; // in paise
  loanDate: string;
}

/**
 * Creates a collection transaction with strict financial validation and auto status management.
 */
export async function createCollection(data: {
  personId: string;
  loanId: string;
  amountPaise: number;
  collectedAt?: Date | null;
  notes?: string | null;
}) {
  assertDbConfigured();
  await ensureDbInitialized();
  if (data.amountPaise <= 0) {
    throw new Error('Collection amount must be greater than ₹0.');
  }

  const now = new Date();
  const collectedAt = data.collectedAt || now;
  if (Number.isNaN(collectedAt.getTime()) || collectedAt > endOfDay(now)) {
    throw new Error('Collection date must be valid and cannot be in the future.');
  }
  const newId = randomUUID();
  const trimmedNotes = data.notes?.trim() || null;

  if (isDbConfigured()) {
    try {
      return await db.transaction(async (tx) => {
        const [loanRecord] = await tx
          .select()
          .from(loans)
          .where(eq(loans.id, data.loanId))
          .for('update');

        if (!loanRecord) throw new Error('Selected finance record not found.');
        if (loanRecord.personId !== data.personId) {
          throw new Error('Selected finance record does not belong to this person.');
        }
        if (loanRecord.status === 'COMPLETED') {
          throw new Error('Cannot add collection to an already completed record.');
        }

        const [existingCols] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${collections.amount}), 0)` })
          .from(collections)
          .where(eq(collections.loanId, data.loanId));
        const currentCollected = Number(existingCols?.total ?? 0);
        const remainingPaise = Math.max(0, Number(loanRecord.loanAmount) - currentCollected);

        if (data.amountPaise > remainingPaise) {
          throw new Error(
            `Collection cannot be greater than the remaining balance of ${formatRupees(remainingPaise)}.`
          );
        }

        await tx.insert(collections).values({
          id: newId,
          loanId: data.loanId,
          personId: data.personId,
          amount: data.amountPaise,
          collectedAt,
          notes: trimmedNotes,
        });

        const newRemaining = remainingPaise - data.amountPaise;
        if (newRemaining <= 0) {
          await tx
            .update(loans)
            .set({ status: 'COMPLETED', updatedAt: new Date() })
            .where(eq(loans.id, data.loanId));
        }

        return {
          id: newId,
          loanId: data.loanId,
          personId: data.personId,
          amount: data.amountPaise,
          completed: newRemaining <= 0,
          collectedAt,
          notes: trimmedNotes,
          createdAt: now,
          updatedAt: now,
        };
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('Collection cannot')) throw err;
      if (err instanceof Error && err.message.includes('Cannot add collection')) throw err;
      console.error('Database insert failed in createCollection:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Gets a single collection by ID with related person and loan details.
 */
export async function getCollectionById(id: string) {
  assertDbConfigured();
  await ensureDbInitialized();
  if (isDbConfigured()) {
    try {
      const [col] = await db
        .select()
        .from(collections)
        .where(eq(collections.id, id));

      if (col) {
        const [person] = await db
          .select()
          .from(people)
          .where(eq(people.id, col.personId));

        const [loan] = await db
          .select()
          .from(loans)
          .where(eq(loans.id, col.loanId));

        return {
          id: col.id,
          loanId: col.loanId,
          personId: col.personId,
          amount: Number(col.amount),
          collectedAt: new Date(col.collectedAt),
          notes: col.notes,
          createdAt: new Date(col.createdAt),
          updatedAt: new Date(col.updatedAt),
          personName: person?.fullName || 'Contact',
          loanAmount: loan ? Number(loan.loanAmount) : 0,
          loanDate: loan?.loanDate || '',
        };
      }
      return null;
    } catch (err) {
      console.error('Database query failed in getCollectionById:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Updates a collection record with financial balance recalculation.
 */
export async function updateCollection(
  id: string,
  data: {
    amountPaise: number;
    collectedAt?: Date | null;
    notes?: string | null;
  }
) {
  assertDbConfigured();
  await ensureDbInitialized();
  if (data.amountPaise <= 0) {
    throw new Error('Collection amount must be greater than ₹0.');
  }

  const now = new Date();

  if (isDbConfigured()) {
    try {
      return await db.transaction(async (tx) => {
        const [col] = await tx
          .select()
          .from(collections)
          .where(eq(collections.id, id))
          .for('update');
        if (!col) throw new Error('Collection record not found.');

        const [loanRecord] = await tx
          .select()
          .from(loans)
          .where(eq(loans.id, col.loanId))
          .for('update');
        if (!loanRecord) throw new Error('Associated record not found.');

        const [otherCols] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${collections.amount}), 0)` })
          .from(collections)
          .where(and(eq(collections.loanId, col.loanId), sql`${collections.id} != ${id}`));
        const otherCollected = Number(otherCols?.total ?? 0);
        const maxAllowedPaise = Math.max(0, Number(loanRecord.loanAmount) - otherCollected);

        if (data.amountPaise > maxAllowedPaise) {
          throw new Error(
            `Collection cannot be greater than the available balance of ${formatRupees(maxAllowedPaise)}.`
          );
        }

        await tx
          .update(collections)
          .set({
            amount: data.amountPaise,
            collectedAt: data.collectedAt || col.collectedAt,
            notes: data.notes !== undefined ? (data.notes?.trim() || null) : col.notes,
            updatedAt: now,
          })
          .where(eq(collections.id, id));

        const totalNowCollected = otherCollected + data.amountPaise;
        const newStatus = totalNowCollected >= Number(loanRecord.loanAmount) ? 'COMPLETED' : 'ACTIVE';
        await tx
          .update(loans)
          .set({ status: newStatus, updatedAt: now })
          .where(eq(loans.id, col.loanId));

        return {
          id,
          loanId: col.loanId,
          personId: col.personId,
          amount: data.amountPaise,
          completed: newStatus === 'COMPLETED',
          collectedAt: data.collectedAt || new Date(col.collectedAt),
          notes: data.notes !== undefined ? (data.notes?.trim() || null) : col.notes,
          createdAt: new Date(col.createdAt),
          updatedAt: now,
        };
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('Collection cannot')) throw err;
      console.error('Database update failed in updateCollection:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Deletes a collection and restores loan status if necessary.
 */
export async function deleteCollection(id: string) {
  assertDbConfigured();
  await ensureDbInitialized();
  if (isDbConfigured()) {
    try {
      return await db.transaction(async (tx) => {
        const [col] = await tx
          .select()
          .from(collections)
          .where(eq(collections.id, id))
          .for('update');
        if (!col) throw new Error('Collection not found.');

        const [loanRecord] = await tx
          .select()
          .from(loans)
          .where(eq(loans.id, col.loanId))
          .for('update');
        if (!loanRecord) throw new Error('Associated loan not found.');

        await tx.delete(collections).where(eq(collections.id, id));
        const [remainingCols] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${collections.amount}), 0)` })
          .from(collections)
          .where(eq(collections.loanId, col.loanId));

        const totalCollectedAfter = Number(remainingCols?.total ?? 0);
        const newStatus = totalCollectedAfter >= Number(loanRecord.loanAmount) ? 'COMPLETED' : 'ACTIVE';
        await tx
          .update(loans)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(loans.id, col.loanId));
        return true;
      });
    } catch (err) {
      console.error('Database delete failed in deleteCollection:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

/**
 * Fetches collections for today.
 */
export async function getTodayCollections() {
  assertDbConfigured();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (isDbConfigured()) {
    try {
      const todayRows = await db
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
            gte(collections.collectedAt, todayStart),
            lte(collections.collectedAt, todayEnd)
          )
        )
        .orderBy(desc(collections.collectedAt), desc(collections.id));

      const totalCollectedToday = todayRows.reduce((sum, c) => sum + Number(c.amount), 0);
      const items = todayRows.map((c) => ({
        id: c.id,
        loanId: c.loanId,
        personId: c.personId,
        amount: Number(c.amount),
        collectedAt: new Date(c.collectedAt),
        notes: c.notes,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        personName: c.personName,
        personPhone: c.personPhone,
        loanAmount: Number(c.loanAmount),
        loanDate: c.loanDate,
      }));

      return {
        totalCollectedToday,
        count: todayRows.length,
        items,
      };
    } catch (err) {
      console.error('Database query failed in getTodayCollections:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

export type HistoryFilterRange =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'year'
  | 'all'
  | 'custom';

export interface HistoryQueryOptions {
  range?: HistoryFilterRange;
  startDate?: string;
  endDate?: string;
  personId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export type HistoryActivityType = 'investment' | 'collection';

export interface HistoryActivity {
  id: string;
  type: HistoryActivityType;
  loanId: string;
  personId: string;
  amount: number;
  activityAt: Date;
  createdAt: Date;
  notes: string | null;
  personName: string;
  personPhone: string | null;
  loanAmount: number;
  loanDate: string;
}

/**
 * Fetches loan investments and collections in one date-filtered activity history.
 */
export async function getFinancialActivityHistory(options: HistoryQueryOptions = {}) {
  assertDbConfigured();
  await ensureDbInitialized();
  const now = new Date();
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  switch (options.range) {
    case 'today':
      fromDate = startOfDay(now);
      toDate = endOfDay(now);
      break;
    case 'yesterday':
      fromDate = startOfDay(subDays(now, 1));
      toDate = endOfDay(subDays(now, 1));
      break;
    case 'week':
      fromDate = startOfWeek(now, { weekStartsOn: 1 });
      toDate = now;
      break;
    case 'month':
      fromDate = startOfMonth(now);
      toDate = now;
      break;
    case 'year':
      fromDate = new Date(now.getFullYear(), 0, 1);
      toDate = now;
      break;
    case 'custom':
      if (options.startDate) fromDate = startOfDay(new Date(options.startDate));
      if (options.endDate) toDate = endOfDay(new Date(options.endDate));
      break;
    case 'all':
    default:
      break;
  }

  if (isDbConfigured()) {
    try {
      const collectionConditions = [];
      const investmentConditions = [];
      if (fromDate) {
        collectionConditions.push(gte(collections.collectedAt, fromDate));
        investmentConditions.push(gte(loans.loanDate, format(fromDate, 'yyyy-MM-dd')));
      }
      if (toDate) {
        collectionConditions.push(lte(collections.collectedAt, toDate));
        investmentConditions.push(lte(loans.loanDate, format(toDate, 'yyyy-MM-dd')));
      }
      if (options.personId && options.personId !== 'all') {
        collectionConditions.push(eq(collections.personId, options.personId));
        investmentConditions.push(eq(loans.personId, options.personId));
      }
      const search = options.search?.trim();
      if (search) {
        const term = `%${search.toLowerCase()}%`;
        investmentConditions.push(
          or(
            sql`LOWER(${people.fullName}) LIKE ${term}`,
            sql`LOWER(${people.phone}) LIKE ${term}`,
            sql`LOWER(${loans.id}) LIKE ${term}`
          )!
        );
        collectionConditions.push(
          or(
            sql`LOWER(${people.fullName}) LIKE ${term}`,
            sql`LOWER(${people.phone}) LIKE ${term}`,
            sql`LOWER(${loans.id}) LIKE ${term}`,
            sql`LOWER(${collections.id}) LIKE ${term}`
          )!
        );
      }

      const investmentRows = db
        .select({
          type: sql<string>`'investment'`.as('type'),
          activityAt: sql<string>`CONCAT(${loans.loanDate}, ' 00:00:00')`.as('activityAt'),
          id: sql<string>`${loans.id}`.as('id'),
          loanId: sql<string>`${loans.id}`.as('loanId'),
          personId: sql<string>`${loans.personId}`.as('personId'),
          amount: sql<number>`${loans.loanAmount}`.as('amount'),
          notes: sql<string | null>`${loans.notes}`.as('notes'),
          createdAt: sql<Date>`${loans.createdAt}`.as('createdAt'),
          personName: sql<string>`COALESCE(${people.fullName}, 'Contact')`.as('personName'),
          personPhone: sql<string | null>`${people.phone}`.as('personPhone'),
          loanAmount: sql<number>`COALESCE(${loans.loanAmount}, 0)`.as('loanAmount'),
          loanDate: sql<string>`${loans.loanDate}`.as('loanDate'),
        })
        .from(loans)
        .innerJoin(people, eq(people.id, loans.personId))
        .where(investmentConditions.length > 0 ? and(...investmentConditions) : undefined);

      const collectionRows = db
        .select({
          type: sql<string>`'collection'`.as('type'),
          activityAt: sql<string>`DATE_FORMAT(${collections.collectedAt}, '%Y-%m-%d %H:%i:%s')`.as('activityAt'),
          id: sql<string>`${collections.id}`.as('id'),
          loanId: sql<string>`${collections.loanId}`.as('loanId'),
          personId: sql<string>`${collections.personId}`.as('personId'),
          amount: sql<number>`${collections.amount}`.as('amount'),
          notes: sql<string | null>`${collections.notes}`.as('notes'),
          createdAt: sql<Date>`${collections.createdAt}`.as('createdAt'),
          personName: sql<string>`COALESCE(${people.fullName}, 'Contact')`.as('personName'),
          personPhone: sql<string | null>`${people.phone}`.as('personPhone'),
          loanAmount: sql<number>`COALESCE(${loans.loanAmount}, 0)`.as('loanAmount'),
          loanDate: sql<string>`COALESCE(${loans.loanDate}, '')`.as('loanDate'),
        })
        .from(collections)
        .leftJoin(people, eq(people.id, collections.personId))
        .leftJoin(loans, eq(loans.id, collections.loanId))
        .where(collectionConditions.length > 0 ? and(...collectionConditions) : undefined);

      const page = Math.max(1, Math.floor(options.page ?? 1));
      const pageSize = Math.min(25, Math.max(1, Math.floor(options.pageSize ?? 25)));
      const activityRows = db.$with('history_activity').as(
        investmentRows.unionAll(collectionRows)
      );
      const rowsQuery = db
        .with(activityRows)
        .select()
        .from(activityRows)
        .orderBy(desc(activityRows.activityAt), desc(activityRows.id));
      const collectionSummaryQuery = db
        .select({
          totalCollected: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
          count: sql<string>`COUNT(${collections.id})`,
        })
        .from(collections)
        .leftJoin(people, eq(people.id, collections.personId))
        .leftJoin(loans, eq(loans.id, collections.loanId))
        .where(collectionConditions.length > 0 ? and(...collectionConditions) : undefined);
      const investmentSummaryQuery = db
        .select({
          totalInvested: sql<string>`COALESCE(SUM(${loans.loanAmount}), 0)`,
          count: sql<string>`COUNT(${loans.id})`,
        })
        .from(loans)
        .innerJoin(people, eq(people.id, loans.personId))
        .where(investmentConditions.length > 0 ? and(...investmentConditions) : undefined);
      const [rows, [collectionSummary], [investmentSummary]] = await Promise.all([
        rowsQuery.limit(pageSize).offset((page - 1) * pageSize),
        collectionSummaryQuery,
        investmentSummaryQuery,
      ]);
      const totalCollected = Number(collectionSummary?.totalCollected ?? 0);
      const collectionCount = Number(collectionSummary?.count ?? 0);
      const totalInvested = Number(investmentSummary?.totalInvested ?? 0);
      const investmentCount = Number(investmentSummary?.count ?? 0);

      const items: HistoryActivity[] = rows.map((row) => ({
        id: row.id,
        type: row.type as HistoryActivityType,
        loanId: row.loanId,
        personId: row.personId,
        amount: Number(row.amount),
        activityAt: new Date(row.activityAt),
        notes: row.notes,
        createdAt: new Date(row.createdAt),
        personName: row.personName,
        personPhone: row.personPhone,
        loanAmount: Number(row.loanAmount),
        loanDate: row.loanDate,
      }));

      return {
        totalCollected,
        totalInvested,
        collectionCount,
        investmentCount,
        count: collectionCount + investmentCount,
        items,
        page,
        pageSize,
      };
    } catch (err) {
      console.error('Database query failed in getCollectionsHistory:', err);
      throw err;
    }
  }

  throw new Error('DATABASE_URL is not configured.');
}

export async function getCollectionsHistory(options: HistoryQueryOptions = {}) {
  assertDbConfigured();
  await ensureDbInitialized();
  const now = new Date();
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  switch (options.range) {
    case 'today':
      fromDate = startOfDay(now);
      toDate = endOfDay(now);
      break;
    case 'yesterday':
      fromDate = startOfDay(subDays(now, 1));
      toDate = endOfDay(subDays(now, 1));
      break;
    case 'week':
      fromDate = startOfWeek(now, { weekStartsOn: 1 });
      toDate = now;
      break;
    case 'month':
      fromDate = startOfMonth(now);
      toDate = now;
      break;
    case 'year':
      fromDate = new Date(now.getFullYear(), 0, 1);
      toDate = now;
      break;
    case 'custom':
      if (options.startDate) fromDate = startOfDay(new Date(options.startDate));
      if (options.endDate) toDate = endOfDay(new Date(options.endDate));
      break;
    case 'all':
    default:
      break;
  }

  if (!isDbConfigured()) throw new Error('DATABASE_URL is not configured.');

  const conditions = [];
  if (fromDate) conditions.push(gte(collections.collectedAt, fromDate));
  if (toDate) conditions.push(lte(collections.collectedAt, toDate));
  if (options.personId && options.personId !== 'all') {
    conditions.push(eq(collections.personId, options.personId));
  }
  const search = options.search?.trim();
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${people.fullName}) LIKE ${term}`,
        sql`LOWER(${people.phone}) LIKE ${term}`,
        sql`LOWER(${loans.id}) LIKE ${term}`,
        sql`LOWER(${collections.id}) LIKE ${term}`
      )!
    );
  }

  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(25, Math.max(1, Math.floor(options.pageSize ?? 25)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rowsQuery = db
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
    .where(where)
    .orderBy(desc(collections.collectedAt), desc(collections.id));
  const summaryQuery = db
    .select({
      totalCollected: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
      count: sql<string>`COUNT(${collections.id})`,
    })
    .from(collections)
    .leftJoin(people, eq(people.id, collections.personId))
    .leftJoin(loans, eq(loans.id, collections.loanId))
    .where(where);
  const [rows, [summary]] = await Promise.all([
    rowsQuery.limit(pageSize).offset((page - 1) * pageSize),
    summaryQuery,
  ]);

  return {
    totalCollected: Number(summary?.totalCollected ?? 0),
    count: Number(summary?.count ?? 0),
    items: rows.map((row) => ({
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
    })),
    page,
    pageSize,
  };
}
