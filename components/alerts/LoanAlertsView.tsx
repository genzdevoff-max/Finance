import Link from 'next/link';
import { AlertTriangle, BellRing, CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRupees } from '@/lib/utils/currency';
import { formatDateDisplay, formatPersonDisplayName } from '@/lib/utils/date';
import type { getLoanDueNotifications } from '@/lib/services/dashboard.service';

type LoanAlert = Awaited<ReturnType<typeof getLoanDueNotifications>>[number];

interface LoanAlertsViewProps {
  alerts: LoanAlert[];
}

export function LoanAlertsView({ alerts }: LoanAlertsViewProps) {
  const groups: { title: string; items: LoanAlert[]; overdue: boolean }[] = [
    {
      title: 'Overdue',
      items: alerts.filter((loan) => loan.daysUntilDue < 0),
      overdue: true,
    },
    {
      title: 'Due today',
      items: alerts.filter((loan) => loan.daysUntilDue === 0),
      overdue: false,
    },
    {
      title: 'Due tomorrow',
      items: alerts.filter((loan) => loan.daysUntilDue === 1),
      overdue: false,
    },
    {
      title: 'Ending in the next 2–7 days',
      items: alerts.filter((loan) => loan.daysUntilDue >= 2 && loan.daysUntilDue <= 7),
      overdue: false,
    },
  ];

  return (
    <div className="space-y-4 p-4">
      {alerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No loan alerts"
          description="There are no active loans ending in the next 7 days or overdue with an unpaid balance."
        />
      ) : (
        <>
          <Card className="border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Loans needing attention</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Active loans appear here from 7 days before their due date through expiry and
                  afterward, as long as they still have an unpaid balance.
                </p>
              </div>
            </div>
          </Card>

          {groups.map(({ title, items, overdue }) =>
            items.length === 0 ? null : (
              <section key={title} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2
                    className={`flex items-center gap-1.5 text-sm font-bold ${
                      overdue ? 'text-rose-800' : 'text-amber-800'
                    }`}
                  >
                    {overdue && <AlertTriangle className="h-4 w-4" />}
                    {title}
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">
                    {items.length} {items.length === 1 ? 'loan' : 'loans'} ·{' '}
                    {formatRupees(items.reduce((total, loan) => total + loan.remainingAmount, 0))}{' '}
                    unpaid
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((loan) => (
                    <Link key={loan.loanId} href={`/loans/${loan.loanId}`} className="block">
                      <Card
                        className={`flex items-center justify-between gap-3 p-3.5 transition-colors hover:border-slate-300 ${
                          overdue ? 'border-rose-200 bg-rose-50/60' : 'bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {formatPersonDisplayName(loan.personName, loan.tamilName)}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {overdue
                              ? `Expired ${Math.abs(loan.daysUntilDue)} ${
                                  Math.abs(loan.daysUntilDue) === 1 ? 'day' : 'days'
                                } ago`
                              : loan.daysUntilDue > 1
                                ? `Due in ${loan.daysUntilDue} days · ${formatDateDisplay(loan.expectedEndDate)}`
                                : `Due ${formatDateDisplay(loan.expectedEndDate)}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-extrabold text-slate-900">
                            {formatRupees(loan.remainingAmount)}
                          </p>
                          <p className="text-[11px] text-slate-500">remaining</p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )
          )}
        </>
      )}
    </div>
  );
}
