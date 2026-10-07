'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import type { HistoryFilterRange } from '@/lib/services/collections.service';

interface HistoryItem {
  id: string;
  loanId: string;
  personId: string;
  amount: number; // in paise
  collectedAt: Date;
  notes: string | null;
  personName: string;
  loanAmount: number; // in paise
  loanDate: string;
}

interface HistoryViewProps {
  initialItems: HistoryItem[];
  totalCollected: number;
  totalCount: number;
  peopleList: { id: string; fullName: string }[];
  currentRange: HistoryFilterRange;
  currentPersonId?: string;
  currentStartDate?: string;
  currentEndDate?: string;
}

export function HistoryView({
  initialItems,
  totalCollected,
  totalCount,
  peopleList,
  currentRange,
  currentPersonId,
  currentStartDate,
  currentEndDate,
}: HistoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRange, setSelectedRange] = React.useState<HistoryFilterRange>(currentRange);
  const [selectedPerson, setSelectedPerson] = React.useState<string>(currentPersonId || 'all');
  const [customStart, setCustomStart] = React.useState<string>(currentStartDate || '');
  const [customEnd, setCustomEnd] = React.useState<string>(currentEndDate || '');

  // Delete modal state
  const [itemToDelete, setItemToDelete] = React.useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const applyFilters = (range: HistoryFilterRange, personId: string, start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (range && range !== 'all') params.set('range', range);
    if (personId && personId !== 'all') params.set('personId', personId);
    if (range === 'custom') {
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
    }
    router.push(`/history?${params.toString()}`);
  };

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
    router.refresh();
  };

  const filterButtons: { label: string; range: HistoryFilterRange }[] = [
    { label: 'Today', range: 'today' },
    { label: 'Yesterday', range: 'yesterday' },
    { label: 'This Week', range: 'week' },
    { label: 'This Month', range: 'month' },
    { label: 'All Time', range: 'all' },
    { label: 'Custom', range: 'custom' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="rounded-2xl bg-emerald-800 p-5 text-white shadow-md space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-200">
          <span>Total Collected in Period</span>
          <TrendingUp className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="text-3xl font-black">{formatRupees(totalCollected)}</div>
        <div className="text-xs text-emerald-200 border-t border-emerald-700/80 pt-2 flex items-center justify-between">
          <span>{totalCount} {totalCount === 1 ? 'transaction' : 'transactions'} recorded</span>
          <span className="capitalize">{selectedRange}</span>
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
            <option value="all">All Borrowers ({peopleList.length})</option>
            {peopleList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Collection List */}
      {initialItems.length === 0 ? (
        <EmptyState
          icon={History}
          title="No collections in this period"
          description="Try changing the date filter or select 'All Time' to see all transactions."
        />
      ) : (
        <div className="space-y-2.5">
          {initialItems.map((item) => (
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

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">
                    {formatDateDisplay(item.collectedAt)} • {formatTimeDisplay(item.collectedAt)}
                  </span>
                  {item.notes && (
                    <span className="truncate max-w-[150px] text-slate-400 italic">
                      ({item.notes})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-base font-extrabold text-emerald-700">
                    {formatRupees(item.amount)}
                  </div>
                  <Link
                    href={`/loans/${item.loanId}`}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                  >
                    View Loan
                  </Link>
                </div>

                {/* Edit & Delete actions */}
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
              </div>
            </Card>
          ))}
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
