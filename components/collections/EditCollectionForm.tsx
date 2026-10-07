'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { formatRupees, formatRupeesPlain, rupeesToPaise } from '@/lib/utils/currency';
import { formatDateDisplay, formatTimeDisplay } from '@/lib/utils/date';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { updateCollectionAction } from '@/app/actions/collections.actions';
import { AlertCircle, IndianRupee } from 'lucide-react';

interface EditCollectionFormProps {
  collection: {
    id: string;
    personId: string;
    loanId: string;
    personName: string;
    amount: number; // in paise
    collectedAt: Date;
    notes: string | null;
  };
  maxAllowedPaise: number;
}

export function EditCollectionForm({
  collection,
  maxAllowedPaise,
}: EditCollectionFormProps) {
  const router = useRouter();

  const originalRs = collection.amount / 100;
  const [amountStr, setAmountStr] = React.useState<string>(String(originalRs));
  const [notes, setNotes] = React.useState<string>(collection.notes || '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const parsedRupees = parseFloat(amountStr) || 0;
  const parsedPaise = rupeesToPaise(parsedRupees);

  const isAmountOver = parsedPaise > maxAllowedPaise;
  const isAmountZeroOrNegative = parsedRupees <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isAmountZeroOrNegative) {
      setErrorMsg('Collection amount must be greater than ₹0.');
      return;
    }

    if (isAmountOver) {
      setErrorMsg(
        `Amount cannot exceed the total available loan balance of ${formatRupees(maxAllowedPaise)}.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await updateCollectionAction(collection.id, {
        amount: parsedRupees,
        notes: notes.trim() || null,
        loanId: collection.loanId,
        personId: collection.personId,
      });

      setIsSubmitting(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update collection.');
        return;
      }

      router.push(`/loans/${collection.loanId}`);
    } catch {
      setIsSubmitting(false);
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <Card className="bg-white p-5 shadow-sm space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Editing Payment For
        </div>
        <div className="text-base font-bold text-slate-900">{collection.personName}</div>
        <div className="text-xs text-slate-500">
          Recorded on {formatDateDisplay(collection.collectedAt)} at{' '}
          {formatTimeDisplay(collection.collectedAt)}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Input
          label="Corrected Amount (₹) *"
          type="number"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="text-xl font-bold h-13"
          autoFocus
          hint={`Max allowed for this loan: ${formatRupees(maxAllowedPaise)}`}
        />

        {parsedRupees > 0 && !isAmountOver && (
          <p className="text-xs font-semibold text-emerald-700">
            Corrected: {formatRupeesPlain(parsedRupees)}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-semibold text-slate-700">
            Note / Reason for correction
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Corrected mistyped zero"
            className="flex w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-1/3"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="w-2/3"
            isLoading={isSubmitting}
            disabled={isAmountZeroOrNegative || isAmountOver}
          >
            <IndianRupee className="mr-1 h-4 w-4" />
            Save Correction
          </Button>
        </div>
      </form>
    </Card>
  );
}
