import assert from 'node:assert/strict';
import test from 'node:test';
import { getOutstandingPaise, getRepaymentStatus } from '../lib/reports/history-report';
import { historyWorkbookFileName } from '../lib/reports/history-workbook';
import { getLoanExpiryState } from '../lib/utils/date';

test('unpaid loans remain fully outstanding', () => {
  assert.equal(getOutstandingPaise(100_000, 0), 100_000);
  assert.equal(getRepaymentStatus(100_000, 0), 'UNPAID');
});

test('partial repayments reduce the no-interest outstanding balance', () => {
  assert.equal(getOutstandingPaise(100_000, 25_000), 75_000);
  assert.equal(getRepaymentStatus(100_000, 25_000), 'PARTIAL');
});

test('full and excess repayments never produce a negative balance', () => {
  assert.equal(getOutstandingPaise(100_000, 100_000), 0);
  assert.equal(getOutstandingPaise(100_000, 110_000), 0);
  assert.equal(getRepaymentStatus(100_000, 100_000), 'COMPLETED');
});

test('customer export filename uses a safe version of the person name', () => {
  assert.equal(
    historyWorkbookFileName({ personId: 'person-1' }, 'Radhe Clothing & Co.'),
    'finance_history_Radhe_Clothing_Co.xlsx'
  );
});

test('loan expiry warning starts seven days before the end date', () => {
  const today = new Date(2026, 9, 12);
  assert.equal(getLoanExpiryState('2026-10-19', today).label, 'Nearing end');
  assert.equal(getLoanExpiryState('2026-10-20', today).label, 'Active');
  assert.equal(getLoanExpiryState('2026-10-12', today).remainingDays, 0);
  assert.equal(getLoanExpiryState('2026-10-11', today).label, 'Expired');
});
