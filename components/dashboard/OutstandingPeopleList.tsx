import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { Card } from '@/components/ui/Card';
import { Users, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

interface OutstandingPeopleListProps {
  people: {
    id: string;
    fullName: string;
    phone: string | null;
    totalOutstanding: number;
    activeLoansCount: number;
  }[];
}

export function OutstandingPeopleList({ people }: OutstandingPeopleListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-slate-700 stroke-[2.5]" />
          Borrowers with Outstanding Balance
        </h2>
        <Link
          href="/people"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View All
        </Link>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No outstanding balances"
          description="All loans are either paid off or no borrowers exist yet."
          actionHref="/people/new"
          actionText="Add Borrower"
        />
      ) : (
        <div className="space-y-2">
          {people.map((person) => (
            <Link
              key={person.id}
              href={`/people/${person.id}`}
              className="block active:scale-[0.99] transition-transform"
            >
              <Card className="p-3.5 hover:border-slate-300 transition-colors flex items-center justify-between gap-3 bg-white">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate text-sm">
                    {person.fullName}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>
                      {person.activeLoansCount}{' '}
                      {person.activeLoansCount === 1 ? 'active loan' : 'active loans'}
                    </span>
                    {person.phone && <span>• {person.phone}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-slate-900">
                      {formatRupees(person.totalOutstanding)}
                    </div>
                    <span className="text-[11px] font-medium text-amber-600 block">
                      outstanding
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
