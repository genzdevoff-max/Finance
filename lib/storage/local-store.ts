import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { subDays, format } from 'date-fns';

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

const DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');

export function isLocalMode(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === '') return true;
  // If set to default placeholder localhost, run local mode
  if (url.includes('localhost') || url.includes('127.0.0.1')) return true;
  return false;
}

function generateInitialData(): LocalDatabase {
  const now = new Date();

  const rameshId = randomUUID();
  const priyaId = randomUUID();
  const sureshId = randomUUID();
  const anjaliId = randomUUID();
  const rajeshId = randomUUID();

  const rameshLoan1Id = randomUUID();
  const rameshLoan2Id = randomUUID();
  const priyaLoan1Id = randomUUID();
  const sureshLoan1Id = randomUUID();
  const sureshLoan2Id = randomUUID();
  const rajeshLoan1Id = randomUUID();

  return {
    people: [
      {
        id: rameshId,
        fullName: 'Ramesh Kumar',
        phone: '+91 98765 43210',
        address: 'Shop #12, Main Market',
        notes: 'Vegetable vendor, daily morning collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: priyaId,
        fullName: 'Priya Sharma',
        phone: '+91 98111 22334',
        address: 'Flat 402, Shanti Vihar',
        notes: 'Boutique owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: sureshId,
        fullName: 'Suresh Patel',
        phone: '+91 97222 33445',
        address: 'Near Old Bus Stand',
        notes: 'Tea stall owner, reliable daily payer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: anjaliId,
        fullName: 'Anjali Verma',
        phone: '+91 99333 44556',
        address: 'Block C, Rohini',
        notes: 'Tailoring business',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: rajeshId,
        fullName: 'Rajesh Gupta',
        phone: '+91 98444 55667',
        address: 'Gali 4, Karol Bagh',
        notes: 'Grocery store owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    loans: [
      {
        id: rameshLoan1Id,
        personId: rameshId,
        loanAmount: 5000000, // ₹50,000
        loanDate: format(subDays(now, 45), 'yyyy-MM-dd'),
        dailyInstallment: 50000, // ₹500
        status: 'ACTIVE',
        notes: 'Stock purchase loan',
        createdAt: subDays(now, 45).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: rameshLoan2Id,
        personId: rameshId,
        loanAmount: 2500000, // ₹25,000
        loanDate: format(subDays(now, 5), 'yyyy-MM-dd'),
        dailyInstallment: 50000, // ₹500
        status: 'ACTIVE',
        notes: 'Festival season additional stock',
        createdAt: subDays(now, 5).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: priyaLoan1Id,
        personId: priyaId,
        loanAmount: 4000000, // ₹40,000
        loanDate: format(subDays(now, 30), 'yyyy-MM-dd'),
        dailyInstallment: 50000, // ₹500
        status: 'ACTIVE',
        notes: 'Sewing machine investment',
        createdAt: subDays(now, 30).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: sureshLoan1Id,
        personId: sureshId,
        loanAmount: 2000000, // ₹20,000
        loanDate: format(subDays(now, 60), 'yyyy-MM-dd'),
        dailyInstallment: 100000, // ₹1,000
        status: 'COMPLETED',
        notes: 'Initial tea stall renovation - fully repaid!',
        createdAt: subDays(now, 60).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: sureshLoan2Id,
        personId: sureshId,
        loanAmount: 6000000, // ₹60,000
        loanDate: format(subDays(now, 15), 'yyyy-MM-dd'),
        dailyInstallment: 100000, // ₹1,000
        status: 'ACTIVE',
        notes: 'Second stall expansion loan',
        createdAt: subDays(now, 15).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: rajeshLoan1Id,
        personId: rajeshId,
        loanAmount: 1500000, // ₹15,000
        loanDate: format(subDays(now, 10), 'yyyy-MM-dd'),
        dailyInstallment: 30000, // ₹300
        status: 'ACTIVE',
        notes: 'Store lighting and racks',
        createdAt: subDays(now, 10).toISOString(),
        updatedAt: now.toISOString(),
      },
    ],
    collections: [
      {
        id: randomUUID(),
        loanId: rameshLoan1Id,
        personId: rameshId,
        amount: 50000, // ₹500
        collectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30).toISOString(),
        notes: 'Today morning collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        loanId: rameshLoan1Id,
        personId: rameshId,
        amount: 50000, // ₹500
        collectedAt: subDays(now, 1).toISOString(),
        notes: 'Yesterday installment',
        createdAt: subDays(now, 1).toISOString(),
        updatedAt: subDays(now, 1).toISOString(),
      },
      {
        id: randomUUID(),
        loanId: rameshLoan1Id,
        personId: rameshId,
        amount: 2150000, // ₹21,500
        collectedAt: subDays(now, 10).toISOString(),
        notes: 'Bulk repayment',
        createdAt: subDays(now, 10).toISOString(),
        updatedAt: subDays(now, 10).toISOString(),
      },
      {
        id: randomUUID(),
        loanId: priyaLoan1Id,
        personId: priyaId,
        amount: 70000, // ₹700
        collectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 15).toISOString(),
        notes: 'Today afternoon collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        loanId: priyaLoan1Id,
        personId: priyaId,
        amount: 1430000, // ₹14,300
        collectedAt: subDays(now, 7).toISOString(),
        notes: 'Weekly collection',
        createdAt: subDays(now, 7).toISOString(),
        updatedAt: subDays(now, 7).toISOString(),
      },
      {
        id: randomUUID(),
        loanId: sureshLoan1Id,
        personId: sureshId,
        amount: 1000000, // ₹10,000
        collectedAt: subDays(now, 40).toISOString(),
        notes: 'First half',
        createdAt: subDays(now, 40).toISOString(),
        updatedAt: subDays(now, 40).toISOString(),
      },
      {
        id: randomUUID(),
        loanId: sureshLoan1Id,
        personId: sureshId,
        amount: 1000000, // ₹10,000
        collectedAt: subDays(now, 25).toISOString(),
        notes: 'Final installment - closed',
        createdAt: subDays(now, 25).toISOString(),
        updatedAt: subDays(now, 25).toISOString(),
      },
      {
        id: randomUUID(),
        loanId: sureshLoan2Id,
        personId: sureshId,
        amount: 50000, // ₹500
        collectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 45).toISOString(),
        notes: 'Today installment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        loanId: sureshLoan2Id,
        personId: sureshId,
        amount: 1450000, // ₹14,500
        collectedAt: subDays(now, 4).toISOString(),
        notes: 'Earlier installment',
        createdAt: subDays(now, 4).toISOString(),
        updatedAt: subDays(now, 4).toISOString(),
      },
      {
        id: randomUUID(),
        loanId: rajeshLoan1Id,
        personId: rajeshId,
        amount: 100000, // ₹1,000
        collectedAt: subDays(now, 1).toISOString(),
        notes: 'Yesterday installment',
        createdAt: subDays(now, 1).toISOString(),
        updatedAt: subDays(now, 1).toISOString(),
      },
    ],
  };
}

export function readLocalDb(): LocalDatabase {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = generateInitialData();
      writeLocalDb(initial);
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content) as LocalDatabase;
  } catch (err) {
    console.error('Error reading local db file, re-initializing:', err);
    const initial = generateInitialData();
    writeLocalDb(initial);
    return initial;
  }
}

export function writeLocalDb(data: LocalDatabase): void {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}
