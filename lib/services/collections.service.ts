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

  const local = readLocalDb();
  const loanRecord = local.loans.find((l) => l.id === data.loanId);

  if (!loanRecord) {
    throw new Error('Selected loan not found.');
  }

  if (loanRecord.status === 'COMPLETED') {
    throw new Error('Cannot add collection to an already completed loan.');
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

  const nowIso = (data.collectedAt || new Date()).toISOString();
  const newCollection = {
    id: randomUUID(),
    loanId: data.loanId,
    personId: data.personId,
    amount: data.amountPaise,
    collectedAt: nowIso,
    notes: data.notes?.trim() || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    collectedAt: new Date(newCollection.collectedAt),
    createdAt: new Date(newCollection.createdAt),
    updatedAt: new Date(newCollection.updatedAt),
  };
}

/**
 * Gets a single collection by ID with related person and loan details.
 */
export async function getCollectionById(id: string) {
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
    personName: person?.fullName || 'Borrower',
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

  const local = readLocalDb();
  const col = local.collections.find((c) => c.id === id);
  if (!col) throw new Error('Collection record not found.');

  const loanRecord = local.loans.find((l) => l.id === col.loanId);
  if (!loanRecord) throw new Error('Associated loan not found.');

  const otherCollected = local.collections
    .filter((c) => c.loanId === col.loanId && c.id !== id)
    .reduce((sum, c) => sum + c.amount, 0);

  const maxAllowedPaise = Math.max(0, loanRecord.loanAmount - otherCollected);

  if (data.amountPaise > maxAllowedPaise) {
    throw new Error(
      `Collection cannot be greater than the available loan balance of ${formatRupees(maxAllowedPaise)}.`
    );
  }

  col.amount = data.amountPaise;
  if (data.collectedAt) col.collectedAt = data.collectedAt.toISOString();
  if (data.notes !== undefined) col.notes = data.notes?.trim() || null;
  col.updatedAt = new Date().toISOString();

  const totalNowCollected = otherCollected + data.amountPaise;
  loanRecord.status = totalNowCollected >= loanRecord.loanAmount ? 'COMPLETED' : 'ACTIVE';
  loanRecord.updatedAt = new Date().toISOString();

  writeLocalDb(local);

  return {
    ...col,
    collectedAt: new Date(col.collectedAt),
    createdAt: new Date(col.createdAt),
    updatedAt: new Date(col.updatedAt),
  };
}

/**
 * Deletes a collection and restores loan status if necessary.
 */
export async function deleteCollection(id: string) {
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
        personName: person?.fullName || 'Borrower',
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
        personName: person?.fullName || 'Borrower',
        loanAmount: loan?.loanAmount || 0,
        loanDate: loan?.loanDate || '',
      };
    }),
  };
}
