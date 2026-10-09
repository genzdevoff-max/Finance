export type RepaymentStatus = 'UNPAID' | 'PARTIAL' | 'COMPLETED';

export function getRepaymentStatus(principalPaise: number, collectedPaise: number): RepaymentStatus {
  const outstandingPaise = Math.max(0, principalPaise - collectedPaise);
  if (outstandingPaise === 0) return 'COMPLETED';
  if (collectedPaise > 0) return 'PARTIAL';
  return 'UNPAID';
}

export function getOutstandingPaise(principalPaise: number, collectedPaise: number): number {
  return Math.max(0, principalPaise - collectedPaise);
}
