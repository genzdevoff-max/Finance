import { formatRupees } from '@/lib/utils/currency';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from 'date-fns';
import { readLocalDb, writeLocalDb, type Collection } from '@/lib/storage/local-store';
import { db, people, loans, collections, isDbConfigured } from '@/lib/db';
import { eq, sql, gte, lte, and } from 'drizzle-orm';
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
      console.warn('Database insert failed in createCollection, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const loanRecord = local.loans.find((l) => l.id === data.loanId);

  if (!loanRecord) {
    throw new Error('Selected record not found.');
  }

  if (loanRecord.status === 'COMPLETED') {
    throw new Error('Cannot add collection to an already completed record.');
  }

  const currentCollected = local.collections
    .filter((c) => c.loanId === data.loanId)
    .reduce((sum, c) => sum + c.amount, 0);

  const remainingPaise = Math.max(0, loanRecord.loanAmount - currentCollected);

  if (data.amountPaise > remainingPaise) {
    throw new Error(
      `Collection cannot be greater than the remaining balance of ${formatRupees(remainingPaise)}.`
    );
  }

  const nowIso = collectedAt.toISOString();
  const newCollection = {
    id: newId,
    loanId: data.loanId,
    personId: data.personId,
    amount: data.amountPaise,
    collectedAt: nowIso,
    notes: trimmedNotes,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  local.collections.push(newCollection);

  const newRemaining = remainingPaise - data.amountPaise;
  if (newRemaining <= 0) {
    loanRecord.status = 'COMPLETED';
    loanRecord.updatedAt = new Date().toISOString();
  }

  writeLocalDb(local);

  return {
    ...newCollection,
    collectedAt,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Gets a single collection by ID with related person and loan details.
 */
export async function getCollectionById(id: string) {
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
    } catch (err) {
      console.warn('Database query failed in getCollectionById, falling back to local storage:', err);
    }
  }

  const local = readLocalDb();
  const col = local.collections.find((c) => c.id === id);
  if (!col) return null;

  const person = local.people.find((p) => p.id === col.personId);
  const loan = local.loans.find((l) => l.id === col.loanId);

  return {
    id: col.id,
    loanId: col.loanId,
    personId: col.personId,
    amount: col.amount,
    collectedAt: new Date(col.collectedAt),
    notes: col.notes,
    createdAt: new Date(col.createdAt),
    updatedAt: new Date(col.updatedAt),
    personName: person?.fullName || 'Contact',
    loanAmount: loan?.loanAmount || 0,
    loanDate: loan?.loanDate || '',
  };
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
      console.warn('Database update failed in updateCollection, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const col = local.collections.find((c) => c.id === id);
  if (!col) throw new Error('Collection record not found.');

  const loanRecord = local.loans.find((l) => l.id === col.loanId);
  if (!loanRecord) throw new Error('Associated record not found.');

  const otherCollected = local.collections
    .filter((c) => c.loanId === col.loanId && c.id !== id)
    .reduce((sum, c) => sum + c.amount, 0);

  const maxAllowedPaise = Math.max(0, loanRecord.loanAmount - otherCollected);

  if (data.amountPaise > maxAllowedPaise) {
    throw new Error(
      `Collection cannot be greater than the available balance of ${formatRupees(maxAllowedPaise)}.`
    );
  }

  col.amount = data.amountPaise;
  if (data.collectedAt) col.collectedAt = data.collectedAt.toISOString();
  if (data.notes !== undefined) col.notes = data.notes?.trim() || null;
  col.updatedAt = now.toISOString();

  const totalNowCollected = otherCollected + data.amountPaise;
  loanRecord.status = totalNowCollected >= loanRecord.loanAmount ? 'COMPLETED' : 'ACTIVE';
  loanRecord.updatedAt = now.toISOString();

  writeLocalDb(local);

  return {
    ...col,
    collectedAt: new Date(col.collectedAt),
    createdAt: new Date(col.createdAt),
    updatedAt: now,
  };
}

/**
 * Deletes a collection and restores loan status if necessary.
 */
export async function deleteCollection(id: string) {
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
    } catch (err) {
      console.warn('Database delete failed in deleteCollection, falling back to local storage:', err);
    }
  }

  const local = readLocalDb();
  const col = local.collections.find((c) => c.id === id);
  if (!col) throw new Error('Collection not found.');

  const loanId = col.loanId;
  local.collections = local.collections.filter((c) => c.id !== id);

  const loanRecord = local.loans.find((l) => l.id === loanId);
  if (loanRecord) {
    const remainingCols = local.collections.filter((c) => c.loanId === loanId);
    const totalCollectedAfter = remainingCols.reduce((sum, c) => sum + c.amount, 0);
    loanRecord.status = totalCollectedAfter >= loanRecord.loanAmount ? 'COMPLETED' : 'ACTIVE';
    loanRecord.updatedAt = new Date().toISOString();
  }

  writeLocalDb(local);
  return true;
}

/**
 * Fetches collections for today.
 */
export async function getTodayCollections() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (isDbConfigured()) {
    try {
      const todayRows = await db
        .select()
        .from(collections)
        .where(
          and(
            gte(collections.collectedAt, todayStart),
            lte(collections.collectedAt, todayEnd)
          )
        );

      todayRows.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());
      const totalCollectedToday = todayRows.reduce((sum, c) => sum + Number(c.amount), 0);

      const items = [];
      for (const c of todayRows) {
        const [person] = await db
          .select({ fullName: people.fullName })
          .from(people)
          .where(eq(people.id, c.personId));

        const [loan] = await db
          .select({ loanAmount: loans.loanAmount, loanDate: loans.loanDate })
          .from(loans)
          .where(eq(loans.id, c.loanId));

        items.push({
          id: c.id,
          loanId: c.loanId,
          personId: c.personId,
          amount: Number(c.amount),
          collectedAt: new Date(c.collectedAt),
          notes: c.notes,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          personName: person?.fullName || 'Contact',
          loanAmount: loan ? Number(loan.loanAmount) : 0,
          loanDate: loan?.loanDate || '',
        });
      }

      return {
        totalCollectedToday,
        count: todayRows.length,
        items,
      };
    } catch (err) {
      console.warn('Database query failed in getTodayCollections, falling back to local storage:', err);
    }
  }

  const local = readLocalDb();
  const todayItems = local.collections
    .filter((c) => {
      const d = new Date(c.collectedAt);
      return d >= todayStart && d <= todayEnd;
    })
    .sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());

  const totalCollectedToday = todayItems.reduce((sum, c) => sum + c.amount, 0);

  return {
    totalCollectedToday,
    count: todayItems.length,
    items: todayItems.map((c) => {
      const person = local.people.find((p) => p.id === c.personId);
      const loan = local.loans.find((l) => l.id === c.loanId);
      return {
        id: c.id,
        loanId: c.loanId,
        personId: c.personId,
        amount: c.amount,
        collectedAt: new Date(c.collectedAt),
        notes: c.notes,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        personName: person?.fullName || 'Contact',
        loanAmount: loan?.loanAmount || 0,
        loanDate: loan?.loanDate || '',
      };
    }),
  };
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
}

/**
 * Fetches collection history with date ranges and optional person filter.
 */
export async function getCollectionsHistory(options: HistoryQueryOptions = {}) {
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
      toDate = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      fromDate = startOfMonth(now);
      toDate = endOfMonth(now);
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

      let query = db.select().from(collections);
      if (conditions.length > 0) {
        query = db
          .select()
          .from(collections)
          .where(and(...conditions)) as unknown as typeof query;
      }

      const rows = await query;
      rows.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());

      const totalCollected = rows.reduce((sum, c) => sum + Number(c.amount), 0);
      const items = [];

      for (const c of rows) {
        const [person] = await db
          .select({ fullName: people.fullName })
          .from(people)
          .where(eq(people.id, c.personId));

        const [loan] = await db
          .select({ loanAmount: loans.loanAmount, loanDate: loans.loanDate })
          .from(loans)
          .where(eq(loans.id, c.loanId));

        items.push({
          id: c.id,
          loanId: c.loanId,
          personId: c.personId,
          amount: Number(c.amount),
          collectedAt: new Date(c.collectedAt),
          notes: c.notes,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          personName: person?.fullName || 'Contact',
          loanAmount: loan ? Number(loan.loanAmount) : 0,
          loanDate: loan?.loanDate || '',
        });
      }

      return {
        totalCollected,
        count: rows.length,
        items,
      };
    } catch (err) {
      console.warn('Database query failed in getCollectionsHistory, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const items = local.collections.filter((c) => {
    const d = new Date(c.collectedAt);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    if (options.personId && options.personId !== 'all' && c.personId !== options.personId) {
      return false;
    }
    return true;
  });

  items.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());

  const totalCollected = items.reduce((sum, c) => sum + c.amount, 0);

  return {
    totalCollected,
    count: items.length,
    items: items.map((c) => {
      const person = local.people.find((p) => p.id === c.personId);
      const loan = local.loans.find((l) => l.id === c.loanId);
      return {
        id: c.id,
        loanId: c.loanId,
        personId: c.personId,
        amount: c.amount,
        collectedAt: new Date(c.collectedAt),
        notes: c.notes,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        personName: person?.fullName || 'Contact',
        loanAmount: loan?.loanAmount || 0,
        loanDate: loan?.loanDate || '',
      };
    }),
  };
}
