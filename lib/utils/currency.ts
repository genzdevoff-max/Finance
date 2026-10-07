/**
 * Safe Financial Money Handling Utilities
 *
 * Monetary amounts are represented internally as integer PAISE (1 Rupee = 100 paise)
 * to prevent floating-point arithmetic errors.
 * Example: ₹500 = 50,000 paise
 *          ₹1,25,000 = 12,500,000 paise
 */

/**
 * Converts integer paise to rupees (decimal number).
 */
export function paiseToRupees(paise: number | bigint | string | null | undefined): number {
  if (paise === null || paise === undefined) return 0;
  const num = typeof paise === 'bigint' ? Number(paise) : Number(paise);
  if (isNaN(num)) return 0;
  return Math.round(num) / 100;
}

/**
 * Converts rupee amount (entered by user as number or string) to integer paise.
 * Rounds safely to the nearest integer paise.
 */
export function rupeesToPaise(rupees: number | string | null | undefined): number {
  if (rupees === null || rupees === undefined || rupees === '') return 0;
  const cleanStr = typeof rupees === 'string' ? rupees.replace(/,/g, '').trim() : String(rupees);
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Formats integer paise into Indian Rupee string with correct Indian numbering system.
 * Examples:
 *   formatRupees(50000) -> "₹500"
 *   formatRupees(100000) -> "₹1,000"
 *   formatRupees(2550000) -> "₹25,500"
 *   formatRupees(12500000) -> "₹1,25,000"
 */
export function formatRupees(paise: number | bigint | string | null | undefined): string {
  const rs = paiseToRupees(paise);
  const hasDecimals = Math.abs(rs % 1) > 0.0001;

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return formatter.format(rs);
}

/**
 * Formats a plain Rupee number directly (e.g., from an input calculation) into Indian Rupee string.
 */
export function formatRupeesPlain(rupees: number): string {
  const hasDecimals = Math.abs(rupees % 1) > 0.0001;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(rupees);
}
