import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gt, lte, sql } from 'drizzle-orm';
import { db, collections, loans, notifications, people, ensureDbInitialized, assertDbConfigured } from '@/lib/db';
import { formatRupees } from '@/lib/utils/currency';
import {
  addDaysToDateString,
  getRemainingDaysForDate,
  getTodayDateString,
  LOAN_EXPIRY_ALERT_DAYS,
} from '@/lib/utils/date';

export type NotificationType =
  | 'loan_due'
  | 'loan_expired'
  | 'loan_completed'
  | 'loan_created';

export async function createNotification(data: {
  eventKey: string;
  type: NotificationType;
  personId: string;
  loanId: string;
  title: string;
  message: string;
}) {
  assertDbConfigured();
  await ensureDbInitialized();
  try {
    await db.insert(notifications).values({
      id: randomUUID(),
      ...data,
    });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      return;
    }
    console.error('Failed to create in-app notification:', error);
    throw error;
  }
}

export async function getNotifications(limit = 100, offset = 0) {
  assertDbConfigured();
  await ensureDbInitialized();

  const today = getTodayDateString();
  const alertWindowEnd = addDaysToDateString(today, LOAN_EXPIRY_ALERT_DAYS) || today;
  const remainingAmount = sql<number>`
    GREATEST(0, ${loans.loanAmount} - COALESCE(SUM(${collections.amount}), 0))
  `;
  const dueLoans = await db
    .select({
      loanId: loans.id,
      personId: people.id,
      personName: people.fullName,
      loanAmount: loans.loanAmount,
      expectedEndDate: loans.expectedEndDate,
      remainingAmount,
    })
    .from(loans)
    .innerJoin(people, eq(people.id, loans.personId))
    .leftJoin(collections, eq(collections.loanId, loans.id))
    .where(
      and(
        eq(loans.status, 'ACTIVE'),
        lte(loans.expectedEndDate, alertWindowEnd)
      )
    )
    .groupBy(
      loans.id,
      people.id,
      people.fullName,
      loans.loanAmount,
      loans.expectedEndDate
    )
    .having(gt(remainingAmount, 0))
    .orderBy(asc(loans.expectedEndDate), asc(loans.id));

  const dueNotifications = dueLoans.map((loan) => {
    const dueDate = loan.expectedEndDate || today;
    const daysUntilDue = getRemainingDaysForDate(dueDate);
    const isExpired = daysUntilDue < 0;
    const event = isExpired
      ? 'expired'
      : daysUntilDue === 0
        ? 'due-today'
        : daysUntilDue === 1
          ? 'due-tomorrow'
          : 'due-soon';
    return {
      id: randomUUID(),
      eventKey: `${event}:${loan.loanId}:${dueDate}`,
      type: isExpired ? 'loan_expired' : 'loan_due',
      personId: loan.personId,
      loanId: loan.loanId,
      title: isExpired
        ? 'Loan expired with balance'
        : daysUntilDue === 0
          ? 'Loan due today'
          : daysUntilDue === 1
            ? 'Loan due tomorrow'
            : `Loan ending in ${daysUntilDue} days`,
      message: `${loan.personName} · ${isExpired ? `expired ${Math.abs(daysUntilDue)} days ago` : `due ${dueDate}`} · ${formatRupees(Number(loan.remainingAmount))} remaining`,
    };
  });

  for (let offset = 0; offset < dueNotifications.length; offset += 250) {
    const batch = dueNotifications.slice(offset, offset + 250);
    await db
      .insert(notifications)
      .values(batch)
      .onDuplicateKeyUpdate({ set: { eventKey: sql`event_key` } });
  }

  return db
    .select({
      id: notifications.id,
      eventKey: notifications.eventKey,
      type: notifications.type,
      personId: notifications.personId,
      loanId: notifications.loanId,
      title: notifications.title,
      message: notifications.message,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset);
}

export async function getNotificationCount() {
  assertDbConfigured();
  await ensureDbInitialized();
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications);
  return Number(result?.count ?? 0);
}

export async function getUnreadNotificationsCount() {
  assertDbConfigured();
  await ensureDbInitialized();
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(sql`${notifications.readAt} IS NULL`);
  return Number(result?.count ?? 0);
}

export async function markNotificationRead(id: string) {
  assertDbConfigured();
  await ensureDbInitialized();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), sql`${notifications.readAt} IS NULL`));
}

export async function markAllNotificationsRead() {
  assertDbConfigured();
  await ensureDbInitialized();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(sql`${notifications.readAt} IS NULL`);
}

export async function notifyLoanCreated(loanId: string) {
  const [loan] = await db
    .select({
      personId: people.id,
      personName: people.fullName,
      loanAmount: loans.loanAmount,
    })
    .from(loans)
    .innerJoin(people, eq(people.id, loans.personId))
    .where(eq(loans.id, loanId));

  if (!loan) throw new Error(`Cannot create notification: loan ${loanId} was not found.`);
  await createNotification({
    eventKey: `created:${loanId}`,
    type: 'loan_created',
    personId: loan.personId,
    loanId,
    title: 'New loan created',
    message: `${loan.personName} · ${formatRupees(Number(loan.loanAmount))} loan given`,
  });
}

export async function notifyLoanCompleted(loanId: string) {
  const [loan] = await db
    .select({
      personId: people.id,
      personName: people.fullName,
    })
    .from(loans)
    .innerJoin(people, eq(people.id, loans.personId))
    .where(eq(loans.id, loanId));

  if (!loan) throw new Error(`Cannot create notification: loan ${loanId} was not found.`);
  await createNotification({
    eventKey: `completed:${loanId}`,
    type: 'loan_completed',
    personId: loan.personId,
    loanId,
    title: 'Loan fully repaid',
    message: `${loan.personName} has completed all repayments for this loan.`,
  });
}
