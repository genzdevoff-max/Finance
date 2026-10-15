import Link from 'next/link';
import { BriefcaseBusiness, MapPin, Phone, Pencil, UserRound } from 'lucide-react';
import { formatRupees } from '@/lib/utils/currency';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PersonLoansList } from '@/components/people/PersonLoansList';
import type { PersonDetail } from '@/lib/services/people.service';

export function IndividualDashboard({ person }: { person: PersonDetail }) {
  const dueToday = person.dueTodayLoansCount;
  const overdue = person.overdueLoansCount;
  const endingSoon = person.endingSoonLoansCount;

  return (
    <section className="space-y-5" aria-label={`${person.fullName}'s dashboard`}>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">{person.fullName}</h2>
              <p className="text-xs text-slate-500">Individual dashboard</p>
            </div>
          </div>
          <Link
            href={`/people/${person.id}/edit`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phone</dt>
              <dd className="truncate text-xs font-medium text-slate-700">
                {person.phone ? (
                  <a href={`tel:${person.phone}`} className="hover:underline">{person.phone}</a>
                ) : 'Not provided'}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <BriefcaseBusiness className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Work</dt>
              <dd className="truncate text-xs font-medium text-slate-700">{person.work || 'Not provided'}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Address</dt>
              <dd className="line-clamp-2 text-xs font-medium text-slate-700">{person.address || 'Not provided'}</dd>
            </div>
          </div>
        </dl>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="bg-slate-900 px-4 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Outstanding balance</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatRupees(person.totalOutstanding)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-xs">
            <div>
              <p className="text-slate-400">Total lent</p>
              <p className="mt-0.5 font-semibold text-white">{formatRupees(person.totalBorrowed)}</p>
            </div>
            <div>
              <p className="text-slate-400">Total repaid</p>
              <p className="mt-0.5 font-semibold text-emerald-300">{formatRupees(person.totalCollected)}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100">
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500">Active loans</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{person.activeLoansCount}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500">Completed loans</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{person.completedLoansCount}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
          <Link href={`/loans/new?personId=${person.id}`}>
            <Button variant="outline" className="w-full text-sm">Add loan</Button>
          </Link>
          {person.activeLoansCount > 0 ? (
            <Link href={`/collections/new?personId=${person.id}`}>
              <Button className="w-full text-sm">Record collection</Button>
            </Link>
          ) : (
            <Button className="w-full text-sm" disabled>No active loan</Button>
          )}
        </div>
      </Card>

      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Loan investment</h3>
          <p className="text-xs text-slate-500">Amount lent to this person by period</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Today', person.investedToday],
            ['This week', person.investedThisWeek],
            ['This month', person.investedThisMonth],
            ['This year', person.investedThisYear],
          ].map(([label, amount]) => (
            <Card key={label} className="p-3">
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-base font-bold text-slate-900">{formatRupees(Number(amount))}</p>
            </Card>
          ))}
        </div>
      </section>

      {(dueToday > 0 || endingSoon > 0 || overdue > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {endingSoon > 0 && (
            <Card className="border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-semibold text-amber-900">Ending within 7 days</p>
              <p className="mt-1 text-lg font-bold text-amber-900">{endingSoon}</p>
            </Card>
          )}
          {dueToday > 0 && (
            <Card className="border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-semibold text-amber-900">Due today</p>
              <p className="mt-1 text-lg font-bold text-amber-900">{dueToday}</p>
            </Card>
          )}
          {overdue > 0 && (
            <Card className="border-rose-200 bg-rose-50/70 p-3">
              <p className="text-xs font-semibold text-rose-900">Overdue with balance</p>
              <p className="mt-1 text-lg font-bold text-rose-900">{overdue}</p>
            </Card>
          )}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Loans and balances</h3>
            <p className="text-xs text-slate-500">{person.totalLoansCount} total loan{person.totalLoansCount === 1 ? '' : 's'}</p>
          </div>
          <Link
            href={`/loans/new?personId=${person.id}`}
            className="text-xs font-semibold text-emerald-800 hover:underline"
          >
            + Add loan
          </Link>
        </div>
        <PersonLoansList
          personId={person.id}
          loans={person.loans}
          totalCount={person.totalLoansCount}
          currentPage={person.loanPage}
          pageSize={person.loanPageSize}
          totalPages={person.loanTotalPages}
          pageHref={`/dashboard?personId=${encodeURIComponent(person.id)}`}
        />
      </section>
    </section>
  );
}
