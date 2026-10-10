import { formatRupees } from '@/lib/utils/currency';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
} from 'date-fns';
import type { Collection } from '@/lib/db/schema';
import { db, people, loans, collections, isDbConfigured, assertDbConfigured } from '@/lib/db';
import { desc, eq, sql, gte, lte, and } from 'drizzle-orm';
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
  if (data.amountPaise <= 0) {
    throw new Error('Collection amount must be greater than ₹0.');
  }

  const now = new Date();
  const collectedAt = data.collectedAt || now;
  const newId = randomUUID();
  const trimmedNotes = data.notes?.trim() || null;

  if (isDbConfigured()) {
    try {
      const [loanRecord] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, data.loanId));

      if (!loanRecord) {
        throw new Error('Selected finance record not found.');
      }

      if (loanRecord.personId !== data.personId) {
        throw new Error('Selected finance record does not belong to this person.');
      }

      if (loanRecord.status === 'COMPLETED') {
        throw new Error('Cannot add collection to an already completed record.');
      }

      const existingCols = await db
        .select({ total: sql<string>`COALESCE(SUM(${collections.amount}), 0)` })
        .from(collections)
        .where(eq(collections.loanId, data.loanId));

      const currentCollected = Number(existingCols[0]?.total ?? 0);
      const remainingPaise = Math.max(0, Number(loanRecord.loanAmount) - currentCollected);

      if (data.amountPaise > remainingPaise) {
        throw new Error(
          `Collection cannot be greater than the remaining balance of ${formatRupees(remainingPaise)}.`
        );
      }

      await db.insert(collections).values({
        id: newId,
        loanId: data.loanId,
        personId: data.personId,
        amount: data.amountPaise,
        collectedAt,
        notes: trimmedNotes,
      });

      const newRemaining = remainingPaise - data.amountPaise;
      if (newRemaining <= 0) {
        await db
          .update(loans)
          .set({ status: 'COMPLETED', updatedAt: new Date() })
          .where(eq(loans.id, data.loanId));
      }

      return {
        id: newId,
        loanId: data.loanId,
        personId: data.personId,
        amount: data.amountPaise,
        collectedAt,
        notes: trimmedNotes,
        createdAt: now,
        updatedAt: now,
      };
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
  if (data.amountPaise <= 0) {
    throw new Error('Collection amount must be greater than ₹0.');
  }

  const now = new Date();

  if (isDbConfigured()) {
    try {
      const [col] = await db
        .select()
        .from(collections)
        .where(eq(collections.id, id));

      if (!col) throw new Error('Collection record not found.');

      const [loanRecord] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, col.loanId));

      if (!loanRecord) throw new Error('Associated record not found.');

      const otherCols = await db
        .select({ total: sql<string>`COALESCE(SUM(${collections.amount}), 0)` })
        .from(collections)
        .where(and(eq(collections.loanId, col.loanId), sql`${collections.id} != ${id}`));

      const otherCollected = Number(otherCols[0]?.total ?? 0);
      const maxAllowedPaise = Math.max(0, Number(loanRecord.loanAmount) - otherCollected);

      if (data.amountPaise > maxAllowedPaise) {
        throw new Error(
          `Collection cannot be greater than the available balance of ${formatRupees(maxAllowedPaise)}.`
        );
      }

      await db
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
      await db
        .update(loans)
        .set({ status: newStatus, updatedAt: now })
        .where(eq(loans.id, col.loanId));

      return {
        id,
        loanId: col.loanId,
        personId: col.personId,
        amount: data.amountPaise,
        collectedAt: data.collectedAt || new Date(col.collectedAt),
        notes: data.notes !== undefined ? (data.notes?.trim() || null) : col.notes,
        createdAt: new Date(col.createdAt),
        updatedAt: now,
      };
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
  if (isDbConfigured()) {
    try {
      const [col] = await db
        .select()
        .from(collections)
        .where(eq(collections.id, id));

      if (col) {
        await db.delete(collections).where(eq(collections.id, id));

        const [loanRecord] = await db
          .select()
          .from(loans)
          .where(eq(loans.id, col.loanId));

        if (loanRecord) {
          const remainingCols = await db
            .select({ total: sql<string>`COALESCE(SUM(${collections.amount}), 0)` })
            .from(collections)
            .where(eq(collections.loanId, col.loanId));

          const totalCollectedAfter = Number(remainingCols[0]?.total ?? 0);
          const newStatus = totalCollectedAfter >= Number(loanRecord.loanAmount) ? 'COMPLETED' : 'ACTIVE';
          await db
            .update(loans)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(loans.id, col.loanId));
        }

        return true;
      }
      throw new Error('Collection not found.');
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
  | 'all'
  | 'custom';

export interface HistoryQueryOptions {
  range?: HistoryFilterRange;
  startDate?: string;
  endDate?: string;
  personId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Fetches collection history with date ranges and optional person filter.
 */
export async function getCollectionsHistory(options: HistoryQueryOptions = {}) {
  assertDbConfigured();
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
      const conditions = [];
      if (fromDate) conditions.push(gte(collections.collectedAt, fromDate));
      if (toDate) conditions.push(lte(collections.collectedAt, toDate));
      if (options.personId && options.personId !== 'all') {
        conditions.push(eq(collections.personId, options.personId));
      }

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
          loanAmount: sql<string>`COALESCE(${loans.loanAmount}, 0)`,
          loanDate: sql<string>`COALESCE(${loans.loanDate}, '')`,
        })
        .from(collections)
        .leftJoin(people, eq(people.id, collections.personId))
        .leftJoin(loans, eq(loans.id, collections.loanId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(collections.collectedAt), desc(collections.id));

      const shouldPaginate = options.page !== undefined || options.pageSize !== undefined;
      const page = Math.max(1, Math.floor(options.page ?? 1));
      const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 50)));
      let rows: Awaited<typeof rowsQuery>;
      let totalCollected: number;
      let count: number;

      if (shouldPaginate) {
        const summaryQuery = db
          .select({
            totalCollected: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
            count: sql<string>`COUNT(${collections.id})`,
          })
          .from(collections)
          .where(conditions.length > 0 ? and(...conditions) : undefined);
        const [pageRows, [summary]] = await Promise.all([
          rowsQuery.limit(pageSize).offset((page - 1) * pageSize),
          summaryQuery,
        ]);
        rows = pageRows;
        totalCollected = Number(summary?.totalCollected ?? 0);
        count = Number(summary?.count ?? 0);
      } else {
        rows = await rowsQuery;
        totalCollected = rows.reduce((sum, c) => sum + Number(c.amount), 0);
        count = rows.length;
      }

      const items = rows.map((c) => ({
        id: c.id,
        loanId: c.loanId,
        personId: c.personId,
        amount: Number(c.amount),
        collectedAt: new Date(c.collectedAt),
        notes: c.notes,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        personName: c.personName,
        loanAmount: Number(c.loanAmount),
        loanDate: c.loanDate,
      }));

      return {
        totalCollected,
        count,
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
