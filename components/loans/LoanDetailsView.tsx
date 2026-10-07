'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoanSummaryCard } from './LoanSummaryCard';
import { PaymentHistoryList } from './PaymentHistoryList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { deleteLoanAction } from '@/app/actions/loans.actions';
import { Trash2 } from 'lucide-react';
import type { LoanWithFinancials, CollectionWithBalance } from '@/lib/services/loans.service';

interface LoanDetailsViewProps {
  loan: LoanWithFinancials & {
    collections: CollectionWithBalance[];
  };
}

export function LoanDetailsView({ loan }: LoanDetailsViewProps) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);

    const res = await deleteLoanAction(loan.id, loan.personId);
    setIsDeleting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to delete loan');
      return;
    }

    router.push(`/people/${loan.personId}`);
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Main Loan Metrics and Summary */}
      <LoanSummaryCard loan={loan} />

      {/* Payment History List */}
      <PaymentHistoryList
        loanId={loan.id}
        personId={loan.personId}
        collections={loan.collections}
        isLoanActive={loan.status === 'ACTIVE'}
      />

      {/* Destructive Action: Delete Loan */}
      <div className="pt-2 pb-4 text-center">
        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline py-2 px-3 rounded-lg hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Entire Loan</span>
        </button>
      </div>

      {/* Delete Loan Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete this Loan?"
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to delete this loan for <strong>{loan.personName}</strong>?
            </p>
            <p className="text-xs font-medium text-rose-700">
              This will permanently delete this loan and its {loan.collectionCount} payment records.
            </p>
          </div>
        }
        confirmText="Delete Loan"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}
