import { format, isToday, isYesterday, isValid, parseISO } from 'date-fns';

export const LOAN_EXPIRY_ALERT_DAYS = 7;

/**
 * Parses input safely to a Date object.
 */
export function safeDate(input: Date | string | number | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'string') {
    const parsed = parseISO(input);
    if (isValid(parsed)) return parsed;
    const direct = new Date(input);
    return isValid(direct) ? direct : null;
  }
  const date = new Date(input);
  return isValid(date) ? date : null;
}

export function parseDateString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) return safeDate(value);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return isValid(date) ? date : null;
}

export function addDaysToDateString(value: string | null | undefined, days: number): string | null {
  const base = parseDateString(value);
  if (!base || !Number.isFinite(days)) return value ?? null;
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return format(next, 'yyyy-MM-dd');
}

export function getRemainingDaysForDate(value: string | null | undefined, referenceDate = new Date()): number {
  const end = parseDateString(value);
  if (!end) return 0;
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffMs = end.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getLoanExpiryState(
  expectedEndDate: string | null | undefined,
  referenceDate = new Date()
) {
  const remainingDays = getRemainingDaysForDate(expectedEndDate, referenceDate);
  if (remainingDays < 0) {
    return { isExpired: true, remainingDays, label: 'Expired', tone: 'rose' };
  }
  if (remainingDays <= LOAN_EXPIRY_ALERT_DAYS) {
    return { isExpired: false, remainingDays, label: 'Nearing end', tone: 'amber' };
  }
  return { isExpired: false, remainingDays, label: 'Active', tone: 'emerald' };
}

export function formatPersonDisplayName(fullName: string, tamilName?: string | null): string {
  return (fullName || '').trim() || 'Unknown Person';
}

/**
 * Formats a date cleanly (e.g. "Today", "Yesterday", or "07 Oct 2026")
 */
export function formatDateDisplay(input: Date | string | null | undefined): string {
  const d = safeDate(input);
  if (!d) return '—';
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM yyyy');
}

/**
 * Formats time (e.g. "10:32 AM")
 */
export function formatTimeDisplay(input: Date | string | null | undefined): string {
  const d = safeDate(input);
  if (!d) return '—';
  return format(d, 'hh:mm a');
}

/**
 * Formats both date and time (e.g. "07 Oct 2026, 10:32 AM")
 */
export function formatDateTimeDisplay(input: Date | string | null | undefined): string {
  const d = safeDate(input);
  if (!d) return '—';
  return format(d, 'dd MMM yyyy, hh:mm a');
}

/**
 * Returns today's date formatted as YYYY-MM-DD for HTML input[type="date"]
 */
export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
