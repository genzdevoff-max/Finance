import { format, isToday, isYesterday, isValid, parseISO } from 'date-fns';

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
