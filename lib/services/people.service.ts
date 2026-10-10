import { getLoansByPersonId, type LoanWithFinancials } from './loans.service';
import type { Person } from '@/lib/db/schema';
import { db, people, loans, collections, isDbConfigured, assertDbConfigured } from '@/lib/db';
import { asc, eq, or, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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
          phone: people.phone,
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
            .where(or(like(people.fullName, `%${term}%`), like(people.phone, `%${term}%`)))
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

/**
 * Gets a single person by ID with full financial metrics and loans list.
 */
export async function getPersonById(id: string): Promise<PersonDetail | null> {
  assertDbConfigured();
  if (isDbConfigured()) {
    try {
      const [personRecord] = await db
        .select()
        .from(people)
        .where(eq(people.id, id));

      if (personRecord) {
        const personLoans = await getLoansByPersonId(id);

        let totalBorrowed = 0;
        let totalCollected = 0;
        let activeLoansCount = 0;
        let completedLoansCount = 0;

        for (const l of personLoans) {
          totalBorrowed += l.loanAmount;
          totalCollected += l.totalCollected;
          if (l.status === 'ACTIVE') {
            activeLoansCount++;
          } else {
            completedLoansCount++;
          }
        }

        const totalOutstanding = Math.max(0, totalBorrowed - totalCollected);

        return {
          id: personRecord.id,
          fullName: personRecord.fullName,
          phone: personRecord.phone,
          address: personRecord.address,
          notes: personRecord.notes,
          createdAt: new Date(personRecord.createdAt),
          updatedAt: new Date(personRecord.updatedAt),
          totalBorrowed,
          totalCollected,
          totalOutstanding,
          activeLoansCount,
          completedLoansCount,
          totalLoansCount: personLoans.length,
          loans: personLoans,
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
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  assertDbConfigured();
  const newId = randomUUID();
  const now = new Date();
  const trimmedName = data.fullName.trim();
  const phone = data.phone?.trim() || null;
  const address = data.address?.trim() || null;
  const notes = data.notes?.trim() || null;

  if (isDbConfigured()) {
    try {
      await db.insert(people).values({
        id: newId,
        fullName: trimmedName,
        phone,
        address,
        notes,
      });

      return {
        id: newId,
        fullName: trimmedName,
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
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  }
) {
  assertDbConfigured();
  const now = new Date();
  const trimmedName = data.fullName.trim();
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
          phone,
          address,
          notes,
          updatedAt: now,
        })
        .where(eq(people.id, id));

      return {
        id,
        fullName: trimmedName,
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
