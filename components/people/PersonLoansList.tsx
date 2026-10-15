import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { formatDateDisplay, getLoanExpiryState } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileText, ChevronRight, AlertTriangle } from 'lucide-react';
import type { LoanWithFinancials } from '@/lib/services/loans.service';
import { installmentFrequencyLabel } from '@/lib/constants/installment';

interface PersonLoansListProps {
  personId: string;
  loans: LoanWithFinancials[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  pageHref: string;
}

export function PersonLoansList({
  personId,
  loans,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
  pageHref,
}: PersonLoansListProps) {
  if (totalCount === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="This person has no loans"
        description="Create the first finance/loan record for this person to start tracking."
        actionHref={`/loans/new?personId=${personId}`}
        actionText="Add Loan"
      />
    );
  }

  const pageUrl = (page: number) =>
    `${pageHref}${pageHref.includes('?') ? '&' : '?'}loanPage=${page}`;

  return (
    <div className="space-y-3">
    {loans.map((loan, idx) => {
        const expiryState = getLoanExpiryState(loan.expectedEndDate);
        const showExpiryWarning =
          loan.status === 'ACTIVE' &&
          loan.remainingAmount > 0 &&
          !!loan.expectedEndDate &&
          (expiryState.isExpired || expiryState.remainingDays <= 7);

        return (
          <Link
            key={loan.id}
            href={`/loans/${loan.id}`}
            className="block active:scale-[0.99] transition-transform"
          >
            <Card className="space-y-3 bg-white p-4 transition-colors hover:border-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    Loan #{totalCount - (currentPage - 1) * pageSize - idx}
                  </span>
                  <Badge variant={loan.status === 'ACTIVE' ? 'active' : 'completed'}>
                    {loan.status}
                  </Badge>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {formatDateDisplay(loan.loanDate)}
                </span>
              </div>

              {showExpiryWarning && (
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    expiryState.isExpired
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {expiryState.isExpired
                      ? `Expired ${Math.abs(expiryState.remainingDays)} day${Math.abs(expiryState.remainingDays) === 1 ? '' : 's'} ago`
                      : expiryState.remainingDays === 0
                        ? 'Expires today'
                        : expiryState.remainingDays === 1
                          ? 'Expires tomorrow'
                          : `Expires in ${expiryState.remainingDays} days`}
                    {' · '}Expected end: {formatDateDisplay(loan.expectedEndDate)}
                  </span>
                </div>
              )}

              {/* Financial breakdown */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-2.5 py-1 text-center">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Original
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {formatRupees(loan.loanAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Collected
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {formatRupees(loan.totalCollected)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Remaining
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {formatRupees(loan.remainingAmount)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-medium">
                    {loan.percentageCollected}% Repaid ({loan.collectionCount} payments)
                  </span>
                  {loan.dailyInstallment && (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {formatRupees(loan.dailyInstallment)}/
                      {installmentFrequencyLabel(loan.installmentFrequency)}
                    </span>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-300 ${
                      loan.status === 'COMPLETED' ? 'bg-slate-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${loan.percentageCollected}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-1 text-xs font-semibold text-emerald-700">
                <span>View Details & Payments</span>
                <ChevronRight className="ml-0.5 h-4 w-4" />
              </div>
            </Card>
          </Link>
        );
      })}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={pageUrl(currentPage - 1)}
              aria-disabled={currentPage <= 1}
              tabIndex={currentPage <= 1 ? -1 : undefined}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                currentPage <= 1
                  ? 'pointer-events-none border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Previous
            </Link>
            <Link
              href={pageUrl(currentPage + 1)}
              aria-disabled={currentPage >= totalPages}
              tabIndex={currentPage >= totalPages ? -1 : undefined}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                currentPage >= totalPages
                  ? 'pointer-events-none border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
