import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { formatPersonDisplayName } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BellRing, PlusCircle, Wallet, TrendingUp, Users, FileText } from 'lucide-react';
import type { DashboardSummary } from '@/lib/services/dashboard.service';

interface DashboardMetricsProps {
  summary: DashboardSummary;
}

export function DashboardMetrics({ summary }: DashboardMetricsProps) {
  const overdueLoans = summary.loanDueNotifications.filter((loan) => loan.daysUntilDue < 0);
  const dueToday = summary.loanDueNotifications.filter((loan) => loan.daysUntilDue === 0);
  const dueTomorrow = summary.loanDueNotifications.filter((loan) => loan.daysUntilDue === 1);
  const dueThisWeek = summary.loanDueNotifications.filter(
    (loan) => loan.daysUntilDue >= 2 && loan.daysUntilDue <= 7
  );

  const renderDueLoans = (label: string, loans: typeof summary.loanDueNotifications) => {
    if (loans.length === 0) return null;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
          <span>{label}</span>
          <span>
            {loans.length} {loans.length === 1 ? 'loan' : 'loans'} ·{' '}
            {formatRupees(loans.reduce((total, loan) => total + loan.remainingAmount, 0))} remaining
          </span>
        </div>
        <div className="space-y-1">
          {loans.slice(0, 3).map((loan) => (
            <Link
              key={loan.loanId}
              href={`/loans/${loan.loanId}`}
              prefetch={false}
              className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/80 px-2.5 py-2 text-left"
            >
              <span className="truncate text-xs font-bold text-slate-800">
                {formatPersonDisplayName(loan.personName, loan.tamilName)}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-slate-600">
                {formatRupees(loan.remainingAmount)}
              </span>
            </Link>
          ))}
          {loans.length > 3 && (
            <p className="px-1 text-[11px] font-medium text-amber-800">
              + {loans.length - 3} more
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Primary Outstanding Card */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-md shadow-slate-900/10">
        <div className="relative z-10">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Outstanding
            </span>
            <Wallet className="h-5 w-5 text-emerald-400 stroke-[2]" />
          </div>

          <div className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {formatRupees(summary.totalOutstanding)}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-xs">
            <div>
              <span className="text-slate-400">Total Lent: </span>
              <span className="font-semibold text-slate-200">
                {formatRupees(summary.totalLent)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Total Collected: </span>
              <span className="font-semibold text-emerald-400">
                {formatRupees(summary.totalCollected)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Quick Add Collection Action */}
      <Link href="/collections/new" prefetch={false} className="block">
        <Button
          size="lg"
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm flex items-center justify-center gap-2 h-12"
        >
          <PlusCircle className="h-5 w-5 stroke-[2.5]" />
          <span className="text-sm font-bold">Record a collection</span>
        </Button>
      </Link>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="col-span-2 p-4">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wide">Loans given today</span>
            <span className="text-xs font-semibold text-slate-500">
              {summary.todayInvestments.length}{' '}
              {summary.todayInvestments.length === 1 ? 'loan' : 'loans'}
            </span>
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {formatRupees(summary.investedToday)}
          </div>
          {summary.todayInvestments.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
              {summary.todayInvestments.slice(0, 3).map((investment) => (
                <Link
                  key={investment.id}
                  href={`/loans/${investment.id}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-2 text-xs text-slate-700"
                >
                  <span className="truncate">{investment.personName}</span>
                  <span className="shrink-0 font-bold">{formatRupees(investment.amount)}</span>
                </Link>
              ))}
              {summary.todayInvestments.length > 3 && (
                <p className="text-[11px] text-slate-500">
                  + {summary.todayInvestments.length - 3} more
                </p>
              )}
            </div>
          )}
        </Card>

        {summary.loanDueNotifications.length > 0 && (
          <Card className="col-span-2 border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between text-amber-800">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <BellRing className="h-4 w-4" />
                Loan Alerts
              </span>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {summary.loanDueNotifications.length}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-800">
              Ending within 7 days or overdue, with an unpaid balance
            </p>
            <div className="mt-3 space-y-3">
              {renderDueLoans('Overdue', overdueLoans)}
              {renderDueLoans('Due today', dueToday)}
              {renderDueLoans('Due tomorrow', dueTomorrow)}
              {renderDueLoans('Ending in 2–7 days', dueThisWeek)}
            </div>
            <Link
              href="/notifications"
              prefetch={false}
              className="mt-3 block text-right text-xs font-bold text-emerald-800 hover:text-emerald-900"
            >
              View all alerts
            </Link>
          </Card>
        )}

        {/* Collected Today */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wide">Collected today</span>
            <TrendingUp className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {formatRupees(summary.collectedToday)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            {summary.todayCollections.count}{' '}
            {summary.todayCollections.count === 1 ? 'collection' : 'collections'}
          </p>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wide">Collected this week</span>
            <TrendingUp className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {formatRupees(summary.collectedThisWeek)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Monday to today</p>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wide">Lent this week</span>
            <TrendingUp className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {formatRupees(summary.investedThisWeek)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Monday to today</p>
        </Card>

        {/* Active People */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Active People</span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {summary.activePeopleCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Borrowers with balance</p>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wide">Lent this month</span>
            <TrendingUp className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {formatRupees(summary.investedThisMonth)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Month to date</p>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wide">Lent this year</span>
            <TrendingUp className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {formatRupees(summary.investedThisYear)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Year to date</p>
        </Card>

        {/* Active Loans */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Active Loans</span>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {summary.activeLoansCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            {summary.completedLoansCount} closed
          </p>
        </Card>

        {/* Collected This Month */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">This Month</span>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900">
            {formatRupees(summary.collectedThisMonth)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Month to date</p>
        </Card>
      </div>
    </div>
  );
}
