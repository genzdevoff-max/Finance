'use client';

import * as React from 'react';
import Link from 'next/link';
import { formatRupees } from '@/lib/utils/currency';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Search, UserPlus, Users, ChevronRight, Phone } from 'lucide-react';
import type { PersonWithFinancials } from '@/lib/services/people.service';

interface PeopleListProps {
  initialPeople: PersonWithFinancials[];
}

export function PeopleList({ initialPeople }: PeopleListProps) {
  const [search, setSearch] = React.useState('');

  const filteredPeople = React.useMemo(() => {
    if (!search.trim()) return initialPeople;
    const term = search.toLowerCase().trim();
    return initialPeople.filter(
      (p) =>
        p.fullName.toLowerCase().includes(term) ||
        (p.phone && p.phone.toLowerCase().includes(term))
    );
  }, [initialPeople, search]);

  return (
    <div className="space-y-4">
      {/* Top Search & Add Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Link href="/people/new" className="shrink-0">
          <Button size="default" className="h-11 px-3.5 gap-1.5 font-semibold">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Person</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </Link>
      </div>

      {/* People list or empty states */}
      {initialPeople.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          description="Add your first borrower to get started tracking loans and collections."
          actionHref="/people/new"
          actionText="Add Person"
        />
      ) : filteredPeople.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching people"
          description={`No borrower found matching "${search}".`}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredPeople.map((person) => (
            <Link
              key={person.id}
              href={`/people/${person.id}`}
              className="block active:scale-[0.99] transition-transform"
            >
              <Card className="p-4 hover:border-slate-300 transition-colors flex items-center justify-between gap-3 bg-white">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate text-base">
                    {person.fullName}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                    {person.phone && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Phone className="h-3 w-3" />
                        {person.phone}
                      </span>
                    )}
                    <span>
                      {person.activeLoansCount}{' '}
                      {person.activeLoansCount === 1 ? 'active loan' : 'active loans'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="text-base font-extrabold text-slate-900">
                      {formatRupees(person.totalOutstanding)}
                    </div>
                    <span className="text-[11px] font-semibold text-amber-600 block">
                      Outstanding
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
