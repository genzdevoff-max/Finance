'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRupees } from '@/lib/utils/currency';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PersonLoansList } from '@/components/people/PersonLoansList';
import { deletePersonAction } from '@/app/actions/people.actions';
import {
  PlusCircle,
  FilePlus2,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  FileText,
  IndianRupee,
  Download,
} from 'lucide-react';
import type { PersonDetail } from '@/lib/services/people.service';

interface PersonDetailsViewProps {
  person: PersonDetail;
}

export function PersonDetailsView({ person }: PersonDetailsViewProps) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);

    const res = await deletePersonAction(person.id);
    setIsDeleting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to delete person');
      return;
    }

    router.push('/people');
  };

  const hasActiveLoans = person.loans.some((l) => l.status === 'ACTIVE');

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Main Profile & Financial Summary Card */}
      <Card className="bg-white p-5 space-y-4 shadow-sm">
        {/* Profile Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-slate-900 truncate">
              {person.fullName}
            </h2>

            <div className="mt-1 space-y-0.5 text-xs text-slate-600">
              {person.phone && (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <a href={`tel:${person.phone}`} className="hover:underline">
                    {person.phone}
                  </a>
                </div>
              )}
              {person.address && (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{person.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Edit/Delete buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={`/people/${person.id}/edit`}
              aria-label="Edit person"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </Link>
            <button
              type="button"
              aria-label="Delete person"
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {person.notes && (
          <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100 italic">
            {person.notes}
          </div>
        )}

        {/* Big Outstanding Callout */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Current Outstanding Balance
          </span>
          <div className="text-3xl font-black text-white mt-1">
            {formatRupees(person.totalOutstanding)}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300 border-t border-slate-750 pt-2.5">
            <div>
              <span className="text-slate-400">Total Borrowed: </span>
              <span className="font-bold">{formatRupees(person.totalBorrowed)}</span>
            </div>
            <div>
              <span className="text-slate-400">Total Repaid: </span>
              <span className="font-bold text-emerald-400">
                {formatRupees(person.totalCollected)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Add Loan & Add Collection */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Link href={`/loans/new?personId=${person.id}`} className="block">
            <Button variant="outline" className="w-full gap-1.5 h-12 text-sm font-bold border-slate-300">
              <FilePlus2 className="h-4 w-4" />
              <span>Add Loan</span>
            </Button>
          </Link>

          {hasActiveLoans ? (
            <Link href={`/collections/new?personId=${person.id}`} className="block">
              <Button className="w-full gap-1.5 h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-700">
                <IndianRupee className="h-4 w-4" />
                <span>Add Collection</span>
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              variant="secondary"
              className="w-full gap-1.5 h-12 text-sm font-medium opacity-60"
            >
              <IndianRupee className="h-4 w-4" />
              <span>No Active Loan</span>
            </Button>
          )}
        </div>
        <Link
          href={`/api/people/${person.id}/export`}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Download Full Loan History (Excel)
        </Link>
      </Card>

      {/* Loans Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-slate-700 stroke-[2.5]" />
            Loans ({person.loans.length})
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {person.activeLoansCount} active • {person.completedLoansCount} completed
          </span>
        </div>

        <PersonLoansList personId={person.id} loans={person.loans} />
      </div>

      {/* Delete Person Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        variant="danger"
        title={`Delete ${person.fullName}?`}
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to delete this person?
            </p>
            <p className="font-medium text-rose-700 text-xs">
              This will permanently remove all {person.loans.length} loans and related collection records.
            </p>
          </div>
        }
        confirmText="Delete Person"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}
