import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { formatDateDisplay } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PlusCircle, User, Calendar, Clock } from 'lucide-react';
import type { LoanWithFinancials } from '@/lib/services/loans.service';
import { installmentFrequencyLabel } from '@/lib/constants/installment';
import { LoanScheduleEditor } from './LoanScheduleEditor';

interface LoanSummaryCardProps {
  loan: LoanWithFinancials;
}

export function LoanSummaryCard({ loan }: LoanSummaryCardProps) {
  return (
    <div className="space-y-4">
      {/* Main Loan Highlight Card */}
      <Card className="p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/people/${loan.personId}`}
            className="flex items-center gap-1.5 font-bold text-slate-800 hover:text-emerald-700 transition-colors text-base"
          >
            <User className="h-4 w-4 text-emerald-600" />
            <span>{loan.personName}</span>
          </Link>
          <Badge variant={loan.status === 'ACTIVE' ? 'active' : 'completed'}>
            {loan.status}
          </Badge>
        </div>

        {/* Big Remaining Display */}
        <div className="rounded-2xl bg-slate-900 p-4 text-white">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Remaining Balance
          </span>
          <div className="text-3xl font-black text-white mt-1">
            {formatRupees(loan.remainingAmount)}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300 border-t border-slate-800 pt-3">
            <div>
              <span className="text-slate-400">Original: </span>
              <span className="font-bold">{formatRupees(loan.loanAmount)}</span>
            </div>
            <div>
              <span className="text-slate-400">Collected: </span>
              <span className="font-bold text-emerald-400">
                {formatRupees(loan.totalCollected)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Repayment stats */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 font-semibold">
            <span>{loan.percentageCollected}% Repaid</span>
            <span>{loan.collectionCount} Payments</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                loan.status === 'COMPLETED' ? 'bg-slate-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${loan.percentageCollected}%` }}
            />
          </div>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>Loan Date: {formatDateDisplay(loan.loanDate)}</span>
          </div>
          {loan.dailyInstallment && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>Target: {formatRupees(loan.dailyInstallment)}/{installmentFrequencyLabel(loan.installmentFrequency)}</span>
            </div>
          )}
        </div>

        <LoanScheduleEditor
          loanId={loan.id}
          frequency={loan.installmentFrequency}
          installmentPaise={loan.dailyInstallment}
          disabled={loan.status !== 'ACTIVE'}
        />

        {loan.notes && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 italic border border-slate-100">
            Note: {loan.notes}
          </div>
        )}

        {/* Action Button: Add Collection if loan is active */}
        {loan.status === 'ACTIVE' && (
          <div className="pt-2">
            <Link
              href={`/collections/new?personId=${loan.personId}&loanId=${loan.id}`}
              className="block"
            >
              <Button className="w-full gap-2 h-12 text-base font-bold">
                <PlusCircle className="h-5 w-5 stroke-[2.5]" />
                Add Collection for this Loan
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
