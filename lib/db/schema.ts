import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';
import type { InstallmentFrequency } from '@/lib/constants/installment';

/**
 * PEOPLE TABLE
 * Stores people / clients / accounts in the Finance Tracker.
 */
export const people = mysqlTable(
  'people',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('people_full_name_idx').on(table.fullName),
    index('people_phone_idx').on(table.phone),
  ]
);

/**
 * LOANS / FINANCE RECORDS TABLE
 * Each person can have multiple finance / loan records.
 * Amounts are stored as integer paise (e.g. ₹50,000 = 5,000,000 paise).
 */
export const loans = mysqlTable(
  'loans',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    personId: varchar('person_id', { length: 36 })
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    loanAmount: bigint('loan_amount', { mode: 'number' }).notNull(),
    loanDate: varchar('loan_date', { length: 10 }).notNull(), // YYYY-MM-DD
    dailyInstallment: bigint('daily_installment', { mode: 'number' }),
    installmentFrequency: varchar('installment_frequency', { length: 10 })
      .$type<InstallmentFrequency>()
      .notNull()
      .default('DAILY'),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('ACTIVE'), // 'ACTIVE' | 'COMPLETED'
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('loans_person_id_idx').on(table.personId),
    index('loans_status_idx').on(table.status),
    index('loans_loan_date_idx').on(table.loanDate),
  ]
);

/**
 * COLLECTIONS / REPAYMENTS TABLE
 * Single source of truth for all loan repayments / collections.
 * Amounts are stored as integer paise.
 */
export const collections = mysqlTable(
  'collections',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    loanId: varchar('loan_id', { length: 36 })
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    personId: varchar('person_id', { length: 36 })
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    collectedAt: timestamp('collected_at').defaultNow().notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('collections_loan_id_idx').on(table.loanId),
    index('collections_person_id_idx').on(table.personId),
    index('collections_collected_at_idx').on(table.collectedAt),
  ]
);

/**
 * Table Relations
 */
export const peopleRelations = relations(people, ({ many }) => ({
  loans: many(loans),
  collections: many(collections),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  person: one(people, {
    fields: [loans.personId],
    references: [people.id],
  }),
  collections: many(collections),
}));

export const collectionsRelations = relations(collections, ({ one }) => ({
  loan: one(loans, {
    fields: [collections.loanId],
    references: [loans.id],
  }),
  person: one(people, {
    fields: [collections.personId],
    references: [people.id],
  }),
}));

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;

export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
