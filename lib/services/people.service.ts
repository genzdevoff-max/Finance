import { getLoansByPersonId, type LoanWithFinancials } from './loans.service';
import { readLocalDb, writeLocalDb, type Person } from '@/lib/storage/local-store';
import { db, people, loans, collections, isDbConfigured } from '@/lib/db';
import { eq, or, like, sql } from 'drizzle-orm';
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
  if (isDbConfigured()) {
    try {
      let query = db.select().from(people);

      if (searchQuery && searchQuery.trim().length > 0) {
        const term = `%${searchQuery.trim()}%`;
        query = db
          .select()
          .from(people)
          .where(or(like(people.fullName, term), like(people.phone, term))) as unknown as typeof query;
      }

      const allPeople = await query.orderBy(people.fullName);
      const results: PersonWithFinancials[] = [];

      for (const person of allPeople) {
        const loansList = await db
          .select({
            id: loans.id,
            loanAmount: loans.loanAmount,
            status: loans.status,
          })
          .from(loans)
          .where(eq(loans.personId, person.id));

        let totalBorrowed = 0;
        let activeLoansCount = 0;
        let completedLoansCount = 0;

        for (const l of loansList) {
          totalBorrowed += Number(l.loanAmount);
          if (l.status === 'ACTIVE') {
            activeLoansCount++;
          } else {
            completedLoansCount++;
          }
        }

        const collectionsResult = await db
          .select({
            total: sql<string>`COALESCE(SUM(${collections.amount}), 0)`,
          })
          .from(collections)
          .where(eq(collections.personId, person.id));

        const totalCollected = Number(collectionsResult[0]?.total ?? 0);
        const totalOutstanding = Math.max(0, totalBorrowed - totalCollected);

        results.push({
          id: person.id,
          fullName: person.fullName,
          phone: person.phone,
          address: person.address,
          notes: person.notes,
          createdAt: new Date(person.createdAt),
          updatedAt: new Date(person.updatedAt),
          totalBorrowed,
          totalCollected,
          totalOutstanding,
          activeLoansCount,
          completedLoansCount,
          totalLoansCount: loansList.length,
        });
      }

      return results;
    } catch (err) {
      console.warn('Database query failed in getPeopleList, using fallback storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  let peopleList = [...local.people];

  if (searchQuery && searchQuery.trim().length > 0) {
    const term = searchQuery.toLowerCase().trim();
    peopleList = peopleList.filter(
      (p) =>
        p.fullName.toLowerCase().includes(term) ||
        (p.phone && p.phone.toLowerCase().includes(term))
    );
  }

  peopleList.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const results: PersonWithFinancials[] = [];

  for (const person of peopleList) {
    const pLoans = local.loans.filter((l) => l.personId === person.id);
    let totalBorrowed = 0;
    let activeLoansCount = 0;
    let completedLoansCount = 0;

    for (const l of pLoans) {
      totalBorrowed += l.loanAmount;
      if (l.status === 'ACTIVE') activeLoansCount++;
      else completedLoansCount++;
    }

    const pCollections = local.collections.filter((c) => c.personId === person.id);
    const totalCollected = pCollections.reduce((sum, c) => sum + c.amount, 0);
    const totalOutstanding = Math.max(0, totalBorrowed - totalCollected);

    results.push({
      id: person.id,
      fullName: person.fullName,
      phone: person.phone,
      address: person.address,
      notes: person.notes,
      createdAt: new Date(person.createdAt),
      updatedAt: new Date(person.updatedAt),
      totalBorrowed,
      totalCollected,
      totalOutstanding,
      activeLoansCount,
      completedLoansCount,
      totalLoansCount: pLoans.length,
    });
  }

  return results;
}

/**
 * Gets a single person by ID with full financial metrics and loans list.
 */
export async function getPersonById(id: string): Promise<PersonDetail | null> {
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
    } catch (err) {
      console.warn('Database query failed in getPersonById, using fallback storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const person = local.people.find((p) => p.id === id);
  if (!person) return null;

  const personLoans = await getLoansByPersonId(id);

  let totalBorrowed = 0;
  let totalCollected = 0;
  let activeLoansCount = 0;
  let completedLoansCount = 0;

  for (const l of personLoans) {
    totalBorrowed += l.loanAmount;
    totalCollected += l.totalCollected;
    if (l.status === 'ACTIVE') activeLoansCount++;
    else completedLoansCount++;
  }

  const totalOutstanding = Math.max(0, totalBorrowed - totalCollected);

  return {
    id: person.id,
    fullName: person.fullName,
    phone: person.phone,
    address: person.address,
    notes: person.notes,
    createdAt: new Date(person.createdAt),
    updatedAt: new Date(person.updatedAt),
    totalBorrowed,
    totalCollected,
    totalOutstanding,
    activeLoansCount,
    completedLoansCount,
    totalLoansCount: personLoans.length,
    loans: personLoans,
  };
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
      console.warn('Database insert failed in createPerson, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const nowIso = now.toISOString();
  const newPerson = {
    id: newId,
    fullName: trimmedName,
    phone,
    address,
    notes,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  local.people.push(newPerson);
  writeLocalDb(local);

  return {
    ...newPerson,
    createdAt: now,
    updatedAt: now,
  };
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
  const now = new Date();
  const trimmedName = data.fullName.trim();
  const phone = data.phone?.trim() || null;
  const address = data.address?.trim() || null;
  const notes = data.notes?.trim() || null;

  if (isDbConfigured()) {
    try {
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
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      console.warn('Database update failed in updatePerson, falling back to local storage:', err);
    }
  }

  // Fallback to local store
  const local = readLocalDb();
  const person = local.people.find((p) => p.id === id);
  if (!person) throw new Error('Person not found');

  person.fullName = trimmedName;
  person.phone = phone;
  person.address = address;
  person.notes = notes;
  person.updatedAt = now.toISOString();

  writeLocalDb(local);

  return {
    ...person,
    createdAt: new Date(person.createdAt),
    updatedAt: now,
  };
}

/**
 * Deletes a person and cascades all related loans and collections.
 */
export async function deletePerson(id: string) {
  if (isDbConfigured()) {
    try {
      // In MySQL, delete collections and loans first if foreign keys are not cascading automatically
      await db.delete(collections).where(eq(collections.personId, id));
      await db.delete(loans).where(eq(loans.personId, id));
      await db.delete(people).where(eq(people.id, id));
      return true;
    } catch (err) {
      console.warn('Database delete failed in deletePerson, falling back to local storage:', err);
    }
  }

  const local = readLocalDb();
  local.people = local.people.filter((p) => p.id !== id);
  local.loans = local.loans.filter((l) => l.personId !== id);
  local.collections = local.collections.filter((c) => c.personId !== id);
  writeLocalDb(local);
  return true;
}
