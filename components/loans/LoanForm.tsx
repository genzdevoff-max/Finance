'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loanSchema, type LoanFormData } from '@/lib/validations/loan';
import { createLoanAction } from '@/app/actions/loans.actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { getTodayDateString } from '@/lib/utils/date';
import { formatRupeesPlain } from '@/lib/utils/currency';

interface LoanFormProps {
  people: { id: string; fullName: string }[];
  defaultPersonId?: string;
}

export function LoanForm({ people, defaultPersonId }: LoanFormProps) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      personId: defaultPersonId || (people.length === 1 ? people[0].id : ''),
      loanAmount: undefined,
      loanDate: getTodayDateString(),
      dailyInstallment: undefined,
      notes: '',
    },
  });

  const enteredAmount = watch('loanAmount');
  const enteredDaily = watch('dailyInstallment');

  const onSubmit = async (data: LoanFormData) => {
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await createLoanAction({
        personId: data.personId,
        loanAmount: Number(data.loanAmount),
        loanDate: data.loanDate,
        dailyInstallment: data.dailyInstallment ? Number(data.dailyInstallment) : null,
        notes: data.notes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to create loan.');
        setIsSubmitting(false);
        return;
      }

      router.push(`/people/${data.personId}`);
    } catch {
      setErrorMsg('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white p-5 shadow-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Person Selector */}
        <div className="space-y-1.5">
          <label htmlFor="personId" className="block text-sm font-semibold text-slate-700">
            Person / Client *
          </label>
          <select
            id="personId"
            className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            {...register('personId')}
          >
            <option value="">Select Person...</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          {errors.personId?.message && (
            <p className="text-xs font-medium text-rose-600">{errors.personId.message}</p>
          )}
        </div>

        {/* Loan Amount */}
        <div>
          <Input
            label="Loan Amount (₹) *"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 50000"
            {...register('loanAmount', { valueAsNumber: true })}
            error={errors.loanAmount?.message}
            hint={
              enteredAmount && !isNaN(enteredAmount) && enteredAmount > 0
                ? `Amount: ${formatRupeesPlain(enteredAmount)}`
                : 'Enter total loan amount in rupees'
            }
          />
        </div>

        {/* Loan Date */}
        <div>
          <Input
            label="Loan Date *"
            type="date"
            {...register('loanDate')}
            error={errors.loanDate?.message}
          />
        </div>

        {/* Daily Installment */}
        <div>
          <Input
            label="Expected Daily Installment (₹)"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 500"
            {...register('dailyInstallment', {
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
            error={errors.dailyInstallment?.message}
            hint={
              enteredDaily && !isNaN(enteredDaily) && enteredDaily > 0
                ? `Expected daily collection: ${formatRupeesPlain(enteredDaily)}`
                : 'Optional target amount to collect daily'
            }
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-semibold text-slate-700">
            Notes / Purpose
          </label>
          <textarea
            id="notes"
            rows={2}
            placeholder="e.g. Business expansion, festive stock"
            className="flex w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            {...register('notes')}
          />
          {errors.notes?.message && (
            <p className="text-xs font-medium text-rose-600">{errors.notes.message}</p>
          )}
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
          <Button type="submit" className="w-2/3" isLoading={isSubmitting}>
            Create Loan
          </Button>
        </div>
      </form>
    </Card>
  );
}
