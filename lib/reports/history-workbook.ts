import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { db, assertDbConfigured, collections, loans, people } from '@/lib/db';
import { getOutstandingPaise, getRepaymentStatus } from './history-report';

const currencyFormat = '₹#,##0.00;[Red]-₹#,##0.00';
const dateFormat = 'dd mmm yyyy';

export interface HistoryWorkbookOptions {
  personId?: string;
  startDate?: string;
  endDate?: string;
}

function parseDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  return date;
}

function styleTable(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
  };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    row.alignment = { vertical: 'middle', wrapText: true };
  });
}

export async function createHistoryWorkbook(options: HistoryWorkbookOptions = {}) {
  assertDbConfigured();

  const start = options.startDate ? parseDate(options.startDate, 'Start date') : undefined;
  const end = options.endDate ? parseDate(options.endDate, 'End date') : undefined;
  if (start && end && start > end) {
    throw new Error('Start date must be on or before end date.');
  }

  const [peopleRows, loanRows, collectionRows] = await Promise.all([
    db.select().from(people),
    db.select().from(loans),
    db.select().from(collections),
  ]);

  const personMap = new Map(peopleRows.map((person) => [person.id, person]));
  const scopedLoans = loanRows.filter((loan) => !options.personId || loan.personId === options.personId);
  const scopedLoanIds = new Set(scopedLoans.map((loan) => loan.id));
  const allRelevantCollections = collectionRows.filter(
    (collection) =>
      scopedLoanIds.has(collection.loanId) &&
      (!options.personId || collection.personId === options.personId)
  );
  const totalByLoan = new Map<string, number>();
  for (const collection of allRelevantCollections) {
    totalByLoan.set(
      collection.loanId,
      (totalByLoan.get(collection.loanId) ?? 0) + Number(collection.amount)
    );
  }

  const includedCollections = allRelevantCollections.filter((collection) => {
    const collectedAt = new Date(collection.collectedAt);
    return (
      (!start || collectedAt >= start) &&
      (!end || collectedAt < new Date(end.getTime() + 24 * 60 * 60 * 1000))
    );
  });
  includedCollections.sort(
    (a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime()
  );

  if (options.personId && !personMap.has(options.personId)) {
    throw new Error('Person not found.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Finance Tracker';
  workbook.created = new Date();
  workbook.subject = 'Loan and collection history';
  workbook.title = options.personId
    ? personMap.get(options.personId)?.fullName ?? 'Finance History'
    : 'Finance History';

  const loanSummary = workbook.addWorksheet('Loan Summary');
  loanSummary.columns = [
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Address', key: 'address', width: 34 },
    { header: 'Loan Date', key: 'loanDate', width: 15 },
    { header: 'Principal Amount (₹)', key: 'principal', width: 21 },
    { header: 'Repayment Frequency', key: 'frequency', width: 22 },
    { header: 'Installment Amount (₹)', key: 'installment', width: 23 },
    { header: 'Total Collected (₹)', key: 'collected', width: 21 },
    { header: 'Outstanding Balance (₹)', key: 'outstanding', width: 24 },
    { header: 'Loan Status', key: 'status', width: 16 },
  ];

  const collectionHistory = workbook.addWorksheet('Collection History');
  collectionHistory.columns = [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Amount Collected (₹)', key: 'amount', width: 22 },
    { header: 'Payment Mode', key: 'paymentMode', width: 18 },
    { header: 'Payment Status', key: 'paymentStatus', width: 18 },
  ];

  const installmentSchedule = workbook.addWorksheet('Installment Schedule');
  installmentSchedule.columns = [
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Installment Number', key: 'installmentNumber', width: 22 },
    { header: 'Due Date', key: 'dueDate', width: 18 },
    { header: 'Expected Amount (₹)', key: 'expectedAmount', width: 22 },
    { header: 'Amount Paid (₹)', key: 'amountPaid', width: 20 },
    { header: 'Pending Amount (₹)', key: 'pendingAmount', width: 22 },
    { header: 'Payment Status', key: 'paymentStatus', width: 18 },
  ];

  for (const loan of scopedLoans) {
    const customer = personMap.get(loan.personId);
    if (!customer) continue;
    const collected = totalByLoan.get(loan.id) ?? 0;
    const outstanding = getOutstandingPaise(Number(loan.loanAmount), collected);
    const status = getRepaymentStatus(Number(loan.loanAmount), collected);
    loanSummary.addRow({
      customer: customer.fullName,
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      loanDate: new Date(`${loan.loanDate}T00:00:00.000Z`),
      principal: Number(loan.loanAmount) / 100,
      frequency: loan.installmentFrequency,
      installment: loan.dailyInstallment === null ? null : Number(loan.dailyInstallment) / 100,
      collected: collected / 100,
      outstanding: outstanding / 100,
      status: outstanding === 0 ? 'COMPLETED' : 'ACTIVE',
    });
    installmentSchedule.addRow({
      customer: customer.fullName,
      installmentNumber: 'Not scheduled',
      dueDate: 'Not scheduled',
      expectedAmount: null,
      amountPaid: collected / 100,
      pendingAmount: outstanding / 100,
      paymentStatus: status,
    });
  }

  for (const collection of includedCollections) {
    const customer = personMap.get(collection.personId);
    if (!customer) continue;
    collectionHistory.addRow({
      date: new Date(collection.collectedAt),
      customer: customer.fullName,
      amount: Number(collection.amount) / 100,
      paymentMode: 'Not recorded',
      paymentStatus: 'Successful',
    });
  }

  styleTable(loanSummary);
  styleTable(collectionHistory);
  styleTable(installmentSchedule);

  for (const sheet of [loanSummary, collectionHistory, installmentSchedule]) {
    for (let row = 2; row <= sheet.rowCount; row++) {
      for (let column = 1; column <= sheet.columnCount; column++) {
        const cell = sheet.getRow(row).getCell(column);
        const header = String(sheet.getRow(1).getCell(column).value ?? '');
        if (header.includes('(₹)')) cell.numFmt = currencyFormat;
      }
    }
  }

  for (let row = 2; row <= loanSummary.rowCount; row++) {
    loanSummary.getCell(row, 4).numFmt = dateFormat;
  }
  for (let row = 2; row <= collectionHistory.rowCount; row++) {
    collectionHistory.getCell(row, 1).numFmt = 'dd mmm yyyy hh:mm';
  }

  return workbook;
}

export function historyWorkbookFileName(
  options: HistoryWorkbookOptions = {},
  personName?: string
): string {
  const dateRange =
    options.startDate || options.endDate
      ? `_${options.startDate ?? 'beginning'}_to_${options.endDate ?? format(new Date(), 'yyyy-MM-dd')}`
      : '';
  const safePersonName = personName
    ?.normalize('NFKD')
    .replace(/[^\w -]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const scope = options.personId ? safePersonName || 'customer' : 'all';
  return `finance_history_${scope}${dateRange}.xlsx`;
}
