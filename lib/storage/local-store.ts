import fs from 'fs';
import path from 'path';
import os from 'os';

export interface LocalPerson {
  id: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalLoan {
  id: string;
  personId: string;
  loanAmount: number; // in paise
  loanDate: string; // YYYY-MM-DD
  dailyInstallment: number | null; // in paise
  status: 'ACTIVE' | 'COMPLETED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCollection {
  id: string;
  loanId: string;
  personId: string;
  amount: number; // in paise
  collectedAt: string; // ISO
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalDatabase {
  people: LocalPerson[];
  loans: LocalLoan[];
  collections: LocalCollection[];
}

export type Person = {
  id: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Loan = {
  id: string;
  personId: string;
  loanAmount: number;
  loanDate: string;
  dailyInstallment: number | null;
  status: 'ACTIVE' | 'COMPLETED';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Collection = {
  id: string;
  loanId: string;
  personId: string;
  amount: number;
  collectedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// In-memory fallback if disk operations are completely restricted
let inMemoryDb: LocalDatabase | null = null;

function getDbFilePath(): string {
  // On Vercel / AWS Lambda, /var/task is read-only. We MUST write to os.tmpdir() (/tmp)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'finance-local-db.json');
  }
  return path.join(process.cwd(), 'data', 'local-db.json');
}

function getCleanInitialData(): LocalDatabase {
  return {
    people: [],
    loans: [],
    collections: [],
  };
}

export function readLocalDb(): LocalDatabase {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  const dbPath = getDbFilePath();

  try {
    if (!fs.existsSync(dbPath)) {
      const initial = getCleanInitialData();
      writeLocalDb(initial);
      return initial;
    }
    const content = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(content) as LocalDatabase;
    return {
      people: Array.isArray(parsed?.people) ? parsed.people : [],
      loans: Array.isArray(parsed?.loans) ? parsed.loans : [],
      collections: Array.isArray(parsed?.collections) ? parsed.collections : [],
    };
  } catch (err) {
    console.warn('Could not read disk file, using clean storage:', err);
    inMemoryDb = inMemoryDb || getCleanInitialData();
    return inMemoryDb;
  }
}

export function writeLocalDb(data: LocalDatabase): void {
  inMemoryDb = data;
  const dbPath = getDbFilePath();

  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${dbPath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, dbPath);
  } catch (err) {
    // If filesystem write fails (e.g. read-only serverless environment), fallback silently to memory
    console.warn('Filesystem write not permitted, preserved in memory:', err);
  }
}
