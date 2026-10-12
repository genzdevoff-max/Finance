'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserRound, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface PersonOption {
  id: string;
  fullName: string;
  phone: string | null;
}

export function PersonDashboardSelector({
  selectedPerson,
}: {
  selectedPerson: PersonOption | null;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState(selectedPerson?.fullName ?? '');
  const [results, setResults] = React.useState<PersonOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    setSearch(selectedPerson?.fullName ?? '');
    setResults([]);
    setIsOpen(false);
  }, [selectedPerson?.id, selectedPerson?.fullName]);

  React.useEffect(() => {
    const query = search.trim();
    if (
      query.length < 2 ||
      query.toLocaleLowerCase() === selectedPerson?.fullName.toLocaleLowerCase()
    ) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const response = await fetch(`/api/people/search?q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to search people.');
        const data: { people: PersonOption[] } = await response.json();
        setResults(data.people);
        setIsOpen(true);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name === 'AbortError') return;
        console.error('Dashboard person search failed:', searchError);
        setError('Search failed. Please try again.');
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search, selectedPerson?.fullName]);

  const selectPerson = (person: PersonOption) => {
    setSearch(person.fullName);
    setResults([]);
    setIsOpen(false);
    router.push(`/dashboard?personId=${encodeURIComponent(person.id)}`);
  };

  const clearSelection = () => {
    setSearch('');
    setResults([]);
    setIsOpen(false);
    router.push('/dashboard');
  };

  return (
    <Card className="relative z-20 space-y-2.5 p-3">
      <label htmlFor="dashboard-person-search" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
        <UserRound className="h-3.5 w-3.5 text-emerald-700" />
        View individual dashboard
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="dashboard-person-search"
          value={search}
          placeholder="Search person by name or phone..."
          autoComplete="off"
          className="h-10 pl-9 pr-10 text-sm"
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
            if (event.key === 'Enter' && results[0]) {
              event.preventDefault();
              selectPerson(results[0]);
            }
          }}
        />
        {(selectedPerson || search) && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear person selection"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {results.length > 0 ? (
              results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => selectPerson(person)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"
                >
                  <span className="truncate text-sm font-semibold text-slate-800">{person.fullName}</span>
                  {person.phone && <span className="shrink-0 text-xs text-slate-500">{person.phone}</span>}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-slate-500">No matching people found.</p>
            )}
          </div>
        )}
      </div>
      {(isSearching || error) && (
        <p role={error ? 'alert' : 'status'} className={`text-xs ${error ? 'text-rose-700' : 'text-slate-500'}`}>
          {error || 'Searching...'}
        </p>
      )}
    </Card>
  );
}
