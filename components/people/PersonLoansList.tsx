import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { formatDateDisplay } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileText, ChevronRight, IndianRupee } from 'lucide-react';
import type { LoanWithFinancials } from '@/lib/services/loans.service';

interface PersonLoansListProps {
  personId: string;
  loans: LoanWithFinancials[];
}

export function PersonLoansList({ personId, loans }: PersonLoansListProps) {
  if (loans.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="This person has no loans"
        description="Create the first loan for this borrower to start tracking collections."
        actionHref={`/loans/new?personId=${personId}`}
        actionText="Add Loan"
      />
    );
  }

  return (
    <div className="space-y-3">
      {loans.map((loan, idx) => (
        <Link
          key={loan.id}
          href={`/loans/${loan.id}`}
          className="block active:scale-[0.99] transition-transform"
        >
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  Loan #{loans.length - idx}
                </span>
                <Badge variant={loan.status === 'ACTIVE' ? 'active' : 'completed'}>
                  {loan.status}
                </Badge>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {formatDateDisplay(loan.loanDate)}
              </span>
            </div>

            {/* Financial breakdown */}
            <div className="grid grid-cols-3 gap-2 py-1 text-center bg-slate-50/80 rounded-xl p-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Original
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {formatRupees(loan.loanAmount)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Collected
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {formatRupees(loan.totalCollected)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Remaining
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {formatRupees(loan.remainingAmount)}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-medium text-[11px]">
                  {loan.percentageCollected}% Repaid ({loan.collectionCount} payments)
                </span>
                {loan.dailyInstallment && (
                  <span className="font-semibold text-emerald-700 text-[11px]">
                    {formatRupees(loan.dailyInstallment)}/day
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

            <div className="flex items-center justify-end text-xs font-semibold text-emerald-700 pt-1">
              <span>View Details & Payments</span>
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
