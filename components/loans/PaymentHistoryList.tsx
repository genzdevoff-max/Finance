'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRupees } from '@/lib/utils/currency';
import { formatDateDisplay, formatTimeDisplay } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import { deleteCollectionAction } from '@/app/actions/collections.actions';
import { IndianRupee, Edit2, Trash2, History } from 'lucide-react';
import type { CollectionWithBalance } from '@/lib/services/loans.service';

interface PaymentHistoryListProps {
  loanId: string;
  personId: string;
  collections: CollectionWithBalance[];
  isLoanActive: boolean;
}

export function PaymentHistoryList({
  loanId,
  personId,
  collections,
  isLoanActive,
}: PaymentHistoryListProps) {
  const router = useRouter();
  const [collectionToDelete, setCollectionToDelete] = React.useState<CollectionWithBalance | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (!collectionToDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);

    const res = await deleteCollectionAction(collectionToDelete.id, {
      loanId,
      personId,
    });

    setIsDeleting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to delete collection');
      return;
    }

    setCollectionToDelete(null);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
          <History className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
          Payment History
        </h2>
        <span className="text-xs font-semibold text-slate-500">
          {collections.length} {collections.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      {collections.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No payments yet"
          description="When the borrower pays an installment, record it here."
          actionHref={isLoanActive ? `/collections/new?personId=${personId}&loanId=${loanId}` : undefined}
          actionText={isLoanActive ? 'Add First Collection' : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {collections.map((item) => (
            <Card
              key={item.id}
              className="p-3.5 hover:border-slate-300 transition-colors bg-white flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatRupees(item.amount)}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {formatDateDisplay(item.collectedAt)} at {formatTimeDisplay(item.collectedAt)}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    Remaining balance: <strong className="text-slate-800">{formatRupees(item.remainingAfterCollection)}</strong>
                  </span>
                  {item.notes && (
                    <span className="truncate max-w-[140px] text-slate-400 italic">
                      • {item.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions: Edit & Delete */}
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/collections/${item.id}/edit`}
                  aria-label="Edit collection"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  aria-label="Delete collection"
                  onClick={() => setCollectionToDelete(item)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!collectionToDelete}
        onClose={() => setCollectionToDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title={
          collectionToDelete
            ? `Delete this ${formatRupees(collectionToDelete.amount)} collection?`
            : 'Delete collection?'
        }
        description="Deleting this transaction will update the loan balance and recalculate all totals."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}
