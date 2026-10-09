'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { updateLoanScheduleAction } from '@/app/actions/loans.actions';
import type { InstallmentFrequency } from '@/lib/constants/installment';
import { Button } from '@/components/ui/Button';

interface LoanScheduleEditorProps {
  loanId: string;
  frequency: InstallmentFrequency;
  installmentPaise: number | null;
  disabled: boolean;
}

export function LoanScheduleEditor({
  loanId,
  frequency,
  installmentPaise,
  disabled,
}: LoanScheduleEditorProps) {
  const router = useRouter();
  const [selectedFrequency, setSelectedFrequency] = React.useState(frequency);
  const [amount, setAmount] = React.useState(
    installmentPaise === null ? '' : String(installmentPaise / 100)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const hasChanges =
    selectedFrequency !== frequency ||
    (amount === '' ? null : Number(amount)) !==
      (installmentPaise === null ? null : installmentPaise / 100);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedAmount = amount === '' ? null : Number(amount);
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      setError('Installment amount must be greater than ₹0, or leave it blank.');
      return;
    }

    setSaving(true);
    const result = await updateLoanScheduleAction({
      loanId,
      installmentAmount: parsedAmount,
      installmentFrequency: selectedFrequency,
    });
    setSaving(false);

    if (!result.success) {
      setError(result.error || 'Unable to update the loan schedule.');
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSave} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-700">Collection schedule</p>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label className="space-y-1 text-[11px] font-semibold text-slate-600">
          Frequency
          <select
            value={selectedFrequency}
            disabled={disabled || saving}
            onChange={(event) => setSelectedFrequency(event.target.value as InstallmentFrequency)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:bg-slate-100"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-semibold text-slate-600">
          Installment (₹)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            disabled={disabled || saving}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Optional"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:bg-slate-100"
          />
        </label>
        <Button type="submit" size="sm" disabled={disabled || saving || !hasChanges} isLoading={saving}>
          Save
        </Button>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
      {disabled && <p className="text-[11px] text-slate-500">Completed loan schedules cannot be changed.</p>}
    </form>
  );
}
