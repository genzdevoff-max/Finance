import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
} from 'drizzle-orm/pg-core';

/**
 * PEOPLE TABLE
 * Stores borrowers information.
 */
export const people = pgTable(
  'people',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('people_full_name_idx').on(table.fullName),
    index('people_phone_idx').on(table.phone),
  ]
);

/**
 * LOANS TABLE
 * Each borrower can have multiple separate loans. Never merged.
 * Loan amounts are stored as integer paise (e.g. ₹50,000 = 5,000,000 paise).
 */
export const loans = pgTable(
  'loans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    loanAmount: bigint('loan_amount', { mode: 'number' }).notNull(),
    loanDate: date('loan_date').notNull(),
    dailyInstallment: bigint('daily_installment', { mode: 'number' }),
    status: text('status', { enum: ['ACTIVE', 'COMPLETED'] })
      .notNull()
      .default('ACTIVE'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('loans_person_id_idx').on(table.personId),
    index('loans_status_idx').on(table.status),
    index('loans_loan_date_idx').on(table.loanDate),
  ]
);

/**
 * COLLECTIONS TABLE
 * The single source of truth for all loan repayments/installments.
 * Amounts are stored as integer paise.
 */
export const collections = pgTable(
  'collections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
