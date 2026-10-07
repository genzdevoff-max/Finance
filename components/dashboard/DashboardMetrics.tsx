import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlusCircle, Wallet, TrendingUp, Users, FileText } from 'lucide-react';
import type { DashboardSummary } from '@/lib/services/dashboard.service';

interface DashboardMetricsProps {
  summary: DashboardSummary;
}

export function DashboardMetrics({ summary }: DashboardMetricsProps) {
  return (
    <div className="space-y-4">
      {/* Primary Outstanding Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 p-6 text-white shadow-xl shadow-slate-900/15">
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

          <div className="mt-4 flex items-center justify-between border-t border-slate-750 pt-4 text-xs">
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

        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl" />
      </div>

      {/* Quick Add Collection Action */}
      <Link href="/collections/new" className="block">
        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 h-14"
        >
          <PlusCircle className="h-6 w-6 stroke-[2.5]" />
          <span className="text-base font-bold">Record Collection Now</span>
        </Button>
      </Link>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Collected Today */}
        <Card className="border-emerald-200/70 bg-emerald-50/70 p-4 transition-all">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase tracking-wider">Collected Today</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-emerald-900">
            {formatRupees(summary.collectedToday)}
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 font-medium">
            {summary.todayCollections.count}{' '}
            {summary.todayCollections.count === 1 ? 'collection' : 'collections'}
          </p>
        </Card>

        {/* Active People */}
        <Card className="p-4 transition-all">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Active People</span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-slate-900">
            {summary.activePeopleCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Borrowers with balance</p>
        </Card>

        {/* Active Loans */}
        <Card className="p-4 transition-all">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Active Loans</span>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-slate-900">
            {summary.activeLoansCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            {summary.completedLoansCount} closed
          </p>
        </Card>

        {/* Collected This Month */}
        <Card className="p-4 transition-all">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">This Month</span>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-slate-900">
            {formatRupees(summary.collectedThisMonth)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Month to date</p>
        </Card>
      </div>
    </div>
  );
}
