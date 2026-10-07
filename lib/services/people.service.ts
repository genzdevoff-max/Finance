import { getLoansByPersonId, type LoanWithFinancials } from './loans.service';
import { readLocalDb, writeLocalDb, type Person } from '@/lib/storage/local-store';
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
 * Creates a new borrower record.
 */
export async function createPerson(data: {
  fullName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
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

/**
 * Deletes a person and cascades all related loans and collections.
 */
export async function deletePerson(id: string) {
  const local = readLocalDb();
  local.people = local.people.filter((p) => p.id !== id);
  local.loans = local.loans.filter((l) => l.personId !== id);
  local.collections = local.collections.filter((c) => c.personId !== id);
  writeLocalDb(local);
  return true;
}
