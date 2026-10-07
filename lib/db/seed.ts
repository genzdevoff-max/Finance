import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { subDays, format } from 'date-fns';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function runSeed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in environment or .env.local');
    process.exit(1);
  }

  console.log('Connecting to database for seeding...');
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log('Clearing existing data...');
  await db.delete(schema.collections);
  await db.delete(schema.loans);
  await db.delete(schema.people);

  console.log('Inserting seed borrowers...');
  const [ramesh] = await db
    .insert(schema.people)
    .values({
      fullName: 'Ramesh Kumar',
      phone: '+91 98765 43210',
      address: 'Shop #12, Main Market, Delhi',
      notes: 'Vegetable vendor, daily morning collection',
    })
    .returning();

  const [priya] = await db
    .insert(schema.people)
    .values({
      fullName: 'Priya Sharma',
      phone: '+91 98111 22334',
      address: 'Flat 402, Shanti Vihar, Delhi',
      notes: 'Boutique owner',
    })
    .returning();

  const [suresh] = await db
    .insert(schema.people)
    .values({
      fullName: 'Suresh Patel',
      phone: '+91 97222 33445',
      address: 'Near Old Bus Stand, Delhi',
      notes: 'Tea stall owner, reliable daily payer',
    })
    .returning();

  const [anjali] = await db
    .insert(schema.people)
    .values({
      fullName: 'Anjali Verma',
      phone: '+91 99333 44556',
      address: 'Block C, Rohini, Delhi',
      notes: 'Tailoring business',
    })
    .returning();

  const [rajesh] = await db
    .insert(schema.people)
    .values({
      fullName: 'Rajesh Gupta',
      phone: '+91 98444 55667',
      address: 'Gali 4, Karol Bagh, Delhi',
      notes: 'Grocery store owner',
    })
    .returning();

  console.log('Inserting seed loans...');
  const now = new Date();

  // Ramesh Loan #1: ₹50,000 (Active)
  const [rameshLoan1] = await db
    .insert(schema.loans)
    .values({
      personId: ramesh.id,
      loanAmount: 5000000, // ₹50,000 in paise
      loanDate: format(subDays(now, 45), 'yyyy-MM-dd'),
      dailyInstallment: 50000, // ₹500 in paise
      status: 'ACTIVE',
      notes: 'Stock purchase loan',
    })
    .returning();

  // Ramesh Loan #2: ₹25,000 (Active, recent loan, 0 collections yet)
  await db.insert(schema.loans).values({
    personId: ramesh.id,
    loanAmount: 2500000, // ₹25,000 in paise
    loanDate: format(subDays(now, 5), 'yyyy-MM-dd'),
    dailyInstallment: 50000, // ₹500 in paise
    status: 'ACTIVE',
    notes: 'Festival season additional stock',
  });

  // Priya Loan #1: ₹40,000 (Active)
  const [priyaLoan1] = await db
    .insert(schema.loans)
    .values({
      personId: priya.id,
      loanAmount: 4000000, // ₹40,000 in paise
      loanDate: format(subDays(now, 30), 'yyyy-MM-dd'),
      dailyInstallment: 50000, // ₹500 in paise
      status: 'ACTIVE',
      notes: 'Sewing machine and fabric investment',
    })
    .returning();

  // Suresh Loan #1: ₹20,000 (COMPLETED)
  const [sureshLoanCompleted] = await db
    .insert(schema.loans)
    .values({
      personId: suresh.id,
      loanAmount: 2000000, // ₹20,000 in paise
      loanDate: format(subDays(now, 60), 'yyyy-MM-dd'),
      dailyInstallment: 100000, // ₹1,000 in paise
      status: 'COMPLETED',
      notes: 'Initial tea stall renovation - fully repaid!',
    })
    .returning();

  // Suresh Loan #2: ₹60,000 (Active)
  const [sureshLoan2] = await db
    .insert(schema.loans)
    .values({
      personId: suresh.id,
      loanAmount: 6000000, // ₹60,000 in paise
      loanDate: format(subDays(now, 15), 'yyyy-MM-dd'),
      dailyInstallment: 100000, // ₹1,000 in paise
      status: 'ACTIVE',
      notes: 'Second stall expansion loan',
    })
    .returning();

  // Rajesh Loan #1: ₹15,000 (Active)
  const [rajeshLoan1] = await db
    .insert(schema.loans)
    .values({
      personId: rajesh.id,
      loanAmount: 1500000, // ₹15,000 in paise
      loanDate: format(subDays(now, 10), 'yyyy-MM-dd'),
      dailyInstallment: 30000, // ₹300 in paise
      status: 'ACTIVE',
      notes: 'Store lighting and racks',
    })
    .returning();

  console.log('Inserting seed collections...');
  // Collections for Ramesh Loan 1 (total ₹22,500 collected)
  await db.insert(schema.collections).values([
    {
      loanId: rameshLoan1.id,
      personId: ramesh.id,
      amount: 50000, // ₹500
      collectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30),
      notes: 'Today morning collection',
    },
    {
      loanId: rameshLoan1.id,
      personId: ramesh.id,
      amount: 50000, // ₹500
      collectedAt: subDays(now, 1),
      notes: 'Yesterday installment',
    },
    {
      loanId: rameshLoan1.id,
      personId: ramesh.id,
      amount: 100000, // ₹1,000
      collectedAt: subDays(now, 2),
      notes: 'Double installment',
    },
    {
      loanId: rameshLoan1.id,
      personId: ramesh.id,
      amount: 2050000, // ₹20,500
      collectedAt: subDays(now, 10),
      notes: 'Bulk repayment',
    },
  ]);

  // Collections for Priya Loan 1 (total ₹15,000 collected)
  await db.insert(schema.collections).values([
    {
      loanId: priyaLoan1.id,
      personId: priya.id,
      amount: 70000, // ₹700
      collectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 15),
      notes: 'Today afternoon collection',
    },
    {
      loanId: priyaLoan1.id,
      personId: priya.id,
      amount: 1430000, // ₹14,300
      collectedAt: subDays(now, 7),
      notes: 'Weekly consolidated collection',
    },
  ]);

  // Collections for Suresh Loan 1 (Fully repaid ₹20,000)
  await db.insert(schema.collections).values([
    {
      loanId: sureshLoanCompleted.id,
      personId: suresh.id,
      amount: 1000000, // ₹10,000
      collectedAt: subDays(now, 40),
      notes: 'First half',
    },
    {
      loanId: sureshLoanCompleted.id,
      personId: suresh.id,
      amount: 1000000, // ₹10,000
      collectedAt: subDays(now, 25),
      notes: 'Final installment - loan closed',
    },
  ]);

  // Collections for Suresh Loan 2 (₹15,000 collected)
  await db.insert(schema.collections).values([
    {
      loanId: sureshLoan2.id,
      personId: suresh.id,
      amount: 50000, // ₹500
      collectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 45),
      notes: 'Today collection',
    },
    {
      loanId: sureshLoan2.id,
      personId: suresh.id,
      amount: 1450000, // ₹14,500
      collectedAt: subDays(now, 4),
      notes: 'Installment',
    },
  ]);

  // Collections for Rajesh Loan 1 (₹1,000 collected)
  await db.insert(schema.collections).values([
    {
      loanId: rajeshLoan1.id,
      personId: rajesh.id,
      amount: 100000, // ₹1,000
      collectedAt: subDays(now, 1),
      notes: 'Installment',
    },
  ]);

  console.log('Seed data successfully inserted!');
  await sql.end();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
