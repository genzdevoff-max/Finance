'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Clock, ArrowRight, IndianRupee } from 'lucide-react';
import { formatRupees } from '@/lib/utils/currency';
import { formatTimeDisplay } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';

interface CollectionItem {
  id: string;
  personId: string;
  loanId: string;
  personName: string;
  amount: number;
  collectedAt: Date;
  notes: string | null;
}

interface CollectionPeriod {
  totalCollected: number;
  count: number;
  items: CollectionItem[];
}

interface CollectionsPeriodTabsProps {
  today: CollectionPeriod;
  week: CollectionPeriod;
  month: CollectionPeriod;
}

const periods = [
  { key: 'today', label: 'Daily', title: "Today's Collections", emptyTitle: 'No collections today' },
  { key: 'week', label: 'Weekly', title: "This Week's Collections", emptyTitle: 'No collections this week' },
  { key: 'month', label: 'Monthly', title: "This Month's Collections", emptyTitle: 'No collections this month' },
] as const;

export function CollectionsPeriodTabs({ today, week, month }: CollectionsPeriodTabsProps) {
  const [selected, setSelected] = React.useState<(typeof periods)[number]['key']>('today');
  const data = { today, week, month }[selected];
  const period = periods.find((item) => item.key === selected)!;

  return (
    <section className="space-y-3">
      <div className="flex gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Collection period">
        {periods.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected === item.key}
            onClick={() => setSelected(item.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              selected === item.key
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={period.title} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
            <Clock className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
            {period.title}
          </h2>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Total: {formatRupees(data.totalCollected)}
          </span>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title={period.emptyTitle}
            description="Collections recorded during this period will appear here."
            actionHref="/collections/new"
            actionText="Add Collection"
          />
        ) : (
          <div className="space-y-2">
            {data.items.map((item) => (
              <Card
                key={item.id}
                className="flex items-center justify-between gap-3 bg-white p-3.5 transition-colors hover:border-slate-300"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/people/${item.personId}`}
                    className="block truncate text-sm font-bold text-slate-900 transition-colors hover:text-emerald-700"
                  >
                    {item.personName}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-400">
                      {selected === 'today'
                        ? formatTimeDisplay(item.collectedAt)
                        : format(item.collectedAt, 'dd MMM, h:mm a')}
                    </span>
                    {item.notes && (
                      <span className="max-w-[150px] truncate italic text-slate-400">
                        • {item.notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-extrabold text-emerald-700">
                    {formatRupees(item.amount)}
                  </div>
                  <Link
                    href={`/loans/${item.loanId}`}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-700"
                  >
                    Loan Details <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
