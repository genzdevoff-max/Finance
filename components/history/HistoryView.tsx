'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isBefore, startOfDay } from 'date-fns';
import { formatRupees } from '@/lib/utils/currency';
import { formatDateDisplay, formatTimeDisplay } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import { deleteCollectionAction } from '@/app/actions/collections.actions';
import {
  History,
  TrendingUp,
  Filter,
  Edit2,
  Trash2,
  Calendar,
  IndianRupee,
  Download,
} from 'lucide-react';
import type {
  HistoryActivity,
  HistoryFilterRange,
} from '@/lib/services/collections.service';

interface HistoryViewProps {
  initialItems: HistoryActivity[];
  totalCollected: number;
  totalInvested: number;
  collectionCount: number;
  investmentCount: number;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  peopleList: { id: string; fullName: string }[];
  currentRange: HistoryFilterRange;
  currentPersonId?: string;
  currentStartDate?: string;
  currentEndDate?: string;
  currentSearch?: string;
}

export function HistoryView({
  initialItems,
  totalCollected,
  totalInvested,
  collectionCount,
  investmentCount,
  totalCount,
  currentPage,
  pageSize,
  peopleList,
  currentRange,
  currentPersonId,
  currentStartDate,
  currentEndDate,
  currentSearch,
}: HistoryViewProps) {
  const router = useRouter();

  const [selectedRange, setSelectedRange] = React.useState<HistoryFilterRange>(currentRange);
  const [selectedPerson, setSelectedPerson] = React.useState<string>(currentPersonId || 'all');
  const [customStart, setCustomStart] = React.useState<string>(currentStartDate || '');
  const [customEnd, setCustomEnd] = React.useState<string>(currentEndDate || '');
  const [searchTerm, setSearchTerm] = React.useState(currentSearch || '');

  // Delete modal state
  const [itemToDelete, setItemToDelete] = React.useState<HistoryActivity | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const applyFilters = React.useCallback((
    range: HistoryFilterRange,
    personId: string,
    start?: string,
    end?: string,
    page = 1,
    search = searchTerm
  ) => {
    const params = new URLSearchParams();
    if (range && range !== 'all') params.set('range', range);
    if (personId && personId !== 'all') params.set('personId', personId);
    if (search.trim()) params.set('search', search.trim());
    if (range === 'custom') {
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
    }
    if (page > 1) params.set('page', String(page));
    router.push(`/history?${params.toString()}`);
  }, [router, searchTerm]);

  const handleRangeChange = (range: HistoryFilterRange) => {
    setSelectedRange(range);
    if (range !== 'custom') {
      applyFilters(range, selectedPerson);
    }
  };

  const handlePersonChange = (personId: string) => {
    setSelectedPerson(personId);
    applyFilters(selectedRange, personId, customStart, customEnd);
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters('custom', selectedPerson, customStart, customEnd);
  };

  const exportParams = new URLSearchParams();
  if (selectedPerson !== 'all') exportParams.set('personId', selectedPerson);
  if (selectedRange === 'custom') {
    if (customStart) exportParams.set('startDate', customStart);
    if (customEnd) exportParams.set('endDate', customEnd);
  } else if (selectedRange !== 'all') {
    const range = selectedRange;
    const today = new Date();
    const date = (value: Date) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    let start: Date | undefined;
    let end: Date | undefined;
    if (range === 'today') start = end = today;
    if (range === 'yesterday') {
      start = end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    }
    if (range === 'week') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
      end = today;
    }
    if (range === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    }
    if (range === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
      end = today;
    }
    if (start) exportParams.set('startDate', date(start));
    if (end) exportParams.set('endDate', date(end));
  }
  const exportHref = `/api/history/export${exportParams.size ? `?${exportParams.toString()}` : ''}`;
  const customRangeInvalid =
    selectedRange === 'custom' &&
    (!customStart || !customEnd || customStart > customEnd);
  const filteredItems = initialItems;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstVisibleItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleItem = Math.min(currentPage * pageSize, totalCount);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);

    const res = await deleteCollectionAction(itemToDelete.id, {
      loanId: itemToDelete.loanId,
      personId: itemToDelete.personId,
    });

    setIsDeleting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to delete collection');
      return;
    }

    setItemToDelete(null);
    if (currentPage > 1 && initialItems.length === 1) {
      applyFilters(selectedRange, selectedPerson, customStart, customEnd, currentPage - 1);
    } else {
      router.refresh();
    }
  };

  const filterButtons: { label: string; range: HistoryFilterRange }[] = [
    { label: 'Today', range: 'today' },
    { label: 'This Week', range: 'week' },
    { label: 'This Month', range: 'month' },
    { label: 'This Year', range: 'year' },
    { label: 'All Time', range: 'all' },
    { label: 'Custom', range: 'custom' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-800 p-5 text-white shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-200">
            <span>Collected in Period</span>
            <TrendingUp className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="text-3xl font-black">{formatRupees(totalCollected)}</div>
          <div className="text-xs text-emerald-200 border-t border-emerald-700/80 pt-2 flex items-center justify-between">
            <span>{collectionCount} {collectionCount === 1 ? 'repayment' : 'repayments'}</span>
            <span className="capitalize">{selectedRange}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-sky-800 p-5 text-white shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sky-200">
            <span>Invested in Period</span>
            <IndianRupee className="h-4 w-4 text-sky-300" />
          </div>
          <div className="text-3xl font-black">{formatRupees(totalInvested)}</div>
          <div className="text-xs text-sky-200 border-t border-sky-700/80 pt-2">
            {investmentCount} {investmentCount === 1 ? 'loan issued' : 'loans issued'} during this period
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <Card className="bg-white p-4 space-y-3 shadow-sm">
        {/* Quick Range Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterButtons.map((btn) => (
            <button
              key={btn.range}
              type="button"
              onClick={() => handleRangeChange(btn.range)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedRange === btn.range
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedRange('all');
              setSelectedPerson('all');
              setCustomStart('');
              setCustomEnd('');
              setSearchTerm('');
              applyFilters('all', 'all', undefined, undefined, 1, '');
            }}
          >
            Clear filters
          </Button>
        </div>

        {/* Custom date range inputs */}
        {selectedRange === 'custom' && (
          <form
            onSubmit={handleCustomDateSubmit}
            className="flex items-end gap-2 pt-2 border-t border-slate-100"
          >
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
              />
            </div>
            <Button type="submit" size="sm" className="h-8">
              Filter
            </Button>
          </form>
        )}

        {/* Borrower Filter Dropdown */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedPerson}
            onChange={(e) => handlePersonChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All People ({peopleList.length})</option>
            {peopleList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
        <a
          href={customRangeInvalid ? undefined : exportHref}
          aria-disabled={customRangeInvalid}
          tabIndex={customRangeInvalid ? -1 : undefined}
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors ${
            customRangeInvalid
              ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'
              : 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'
          }`}
        >
          <Download className="h-4 w-4" />
          Download Excel (.xlsx)
        </a>
        <p className="text-[11px] text-slate-500">
          Exports the selected customer and date filters. All Time + All People downloads all history.
        </p>
      </Card>

      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters(selectedRange, selectedPerson, customStart, customEnd, 1, searchTerm);
        }}
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Search financial activity
        </label>
        <div className="flex items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name, phone, loan ID, collection ID..."
            className="h-11"
          />
          <Button type="submit" size="sm" className="h-11 shrink-0">
            Search
          </Button>
          {searchTerm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                applyFilters(selectedRange, selectedPerson, customStart, customEnd, 1, '');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Activity List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={History}
          title={searchTerm ? 'No matching activity' : 'No activity in this period'}
          description={
            searchTerm
              ? 'Try a different borrower name, loan ID, or date.'
              : "Try changing the date filter or select 'All Time' to see all activity."
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <Card
              key={`${item.type}-${item.id}`}
              className="p-3.5 hover:border-slate-300 transition-colors bg-white flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${item.personId}`}
                  className="font-bold text-slate-900 hover:text-emerald-700 transition-colors block truncate text-sm"
                >
                  {item.personName}
                </Link>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">
                    {formatDateDisplay(item.activityAt)}
                    {item.type === 'collection' && ` • ${formatTimeDisplay(item.activityAt)}`}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.type === 'investment'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {item.type === 'investment' ? 'Loan Investment' : 'Repayment'}
                  </span>
                  {item.type === 'collection' &&
                    isBefore(startOfDay(item.activityAt), startOfDay(item.createdAt)) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Late Entry
                    </span>
                  )}
                  {item.type === 'collection' && (
                    <span>Entered {formatDateDisplay(item.createdAt)} at {formatTimeDisplay(item.createdAt)}</span>
                  )}
                  <span>Loan: {item.loanId.slice(0, 8)}</span>
                  {item.notes && (
                    <span className="truncate max-w-[150px] text-slate-400 italic">
                      ({item.notes})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className={`text-base font-extrabold ${
                    item.type === 'investment' ? 'text-sky-700' : 'text-emerald-700'
                  }`}>
                    {formatRupees(item.amount)}
                  </div>
                  <Link
                    href={`/loans/${item.loanId}`}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                  >
                    View Loan
                  </Link>
                </div>

                {item.type === 'collection' && (
                  <div className="flex items-center gap-0.5 pl-1 border-l border-slate-100">
                    <Link
                      href={`/collections/${item.id}/edit`}
                      aria-label="Edit collection"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      aria-label="Delete collection"
                      onClick={() => setItemToDelete(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-medium text-slate-500">
            Showing {firstVisibleItem}–{lastVisibleItem} of {totalCount}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() =>
                applyFilters(selectedRange, selectedPerson, customStart, customEnd, currentPage - 1)
              }
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() =>
                applyFilters(selectedRange, selectedPerson, customStart, customEnd, currentPage + 1)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title={
          itemToDelete
            ? `Delete this ${formatRupees(itemToDelete.amount)} collection?`
            : 'Delete collection?'
        }
        description="Deleting this transaction will update the loan balance."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}
