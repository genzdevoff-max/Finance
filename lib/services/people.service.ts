import { eq, ilike, or, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { people, loans, collections, type Person } from '@/lib/db/schema';
import { getLoansByPersonId, type LoanWithFinancials } from './loans.service';
import { isLocalMode, readLocalDb, writeLocalDb } from '@/lib/storage/local-store';
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
  if (isLocalMode()) {
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

  let query = db.select().from(people);

  if (searchQuery && searchQuery.trim().length > 0) {
    const term = `%${searchQuery.trim()}%`;
    query = db
      .select()
      .from(people)
      .where(or(ilike(people.fullName, term), ilike(people.phone, term))) as unknown as typeof query;
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
      totalBorrowed += l.loanAmount;
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
      ...person,
      totalBorrowed,
      totalCollected,
      totalOutstanding,
      activeLoansCount,
      completedLoansCount,
      totalLoansCount: loansList.length,
    });
  }

  return results;
}

/**
 * Gets a single person by ID with full financial metrics and loans list.
 */
export async function getPersonById(id: string): Promise<PersonDetail | null> {
  if (isLocalMode()) {
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

  const [personRecord] = await db
    .select()
    .from(people)
    .where(eq(people.id, id));

  if (!personRecord) return null;

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
    ...personRecord,
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
 * Creates a new borrower record.
 */
export async function createPerson(data: {
  fullName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  if (isLocalMode()) {
    const local = readLocalDb();
    const nowIso = new Date().toISOString();
    const newPerson = {
      id: randomUUID(),
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    local.people.push(newPerson);
    writeLocalDb(local);

    return {
      ...newPerson,
      createdAt: new Date(newPerson.createdAt),
      updatedAt: new Date(newPerson.updatedAt),
    };
  }

  const [newPerson] = await db
    .insert(people)
    .values({
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .returning();

  return newPerson;
}

/**
 * Updates an existing borrower record.
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
  if (isLocalMode()) {
    const local = readLocalDb();
    const person = local.people.find((p) => p.id === id);
    if (!person) throw new Error('Person not found');

    person.fullName = data.fullName.trim();
    person.phone = data.phone?.trim() || null;
    person.address = data.address?.trim() || null;
    person.notes = data.notes?.trim() || null;
    person.updatedAt = new Date().toISOString();

    writeLocalDb(local);

    return {
      ...person,
      createdAt: new Date(person.createdAt),
      updatedAt: new Date(person.updatedAt),
    };
  }

  const [updated] = await db
    .update(people)
    .set({
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(people.id, id))
    .returning();

  return updated;
}

/**
 * Deletes a person and cascades all related loans and collections.
 */
export async function deletePerson(id: string) {
  if (isLocalMode()) {
    const local = readLocalDb();
    local.people = local.people.filter((p) => p.id !== id);
    local.loans = local.loans.filter((l) => l.personId !== id);
    local.collections = local.collections.filter((c) => c.personId !== id);
    writeLocalDb(local);
    return true;
  }

  await db.delete(people).where(eq(people.id, id));
  return true;
}
