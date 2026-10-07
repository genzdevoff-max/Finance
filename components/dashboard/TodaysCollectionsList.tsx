import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { formatTimeDisplay } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Clock, ArrowRight, IndianRupee } from 'lucide-react';

interface TodaysCollectionsListProps {
  collections: {
    id: string;
    personId: string;
    loanId: string;
    personName: string;
    amount: number;
    collectedAt: Date;
    notes: string | null;
  }[];
  totalToday: number;
}

export function TodaysCollectionsList({
  collections,
  totalToday,
}: TodaysCollectionsListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
          Today&apos;s Collections
        </h2>
        {collections.length > 0 && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Total: {formatRupees(totalToday)}
          </span>
        )}
      </div>

      {collections.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No collections today"
          description="When you record daily collections, they will appear here."
          actionHref="/collections/new"
          actionText="Add Collection"
        />
      ) : (
        <div className="space-y-2">
          {collections.map((item) => (
            <Card
              key={item.id}
              className="p-3.5 hover:border-slate-300 transition-colors bg-white flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${item.personId}`}
                  className="font-bold text-slate-900 hover:text-emerald-700 transition-colors block truncate text-sm"
                >
                  {item.personName}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="text-slate-400 font-medium">
                    {formatTimeDisplay(item.collectedAt)}
                  </span>
                  {item.notes && (
                    <span className="truncate max-w-[150px] text-slate-400 italic">
                      • {item.notes}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-base font-extrabold text-emerald-700">
                  {formatRupees(item.amount)}
                </div>
                <Link
                  href={`/loans/${item.loanId}`}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Loan Details <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
