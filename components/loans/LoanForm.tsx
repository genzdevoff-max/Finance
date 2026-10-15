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
import { installmentFrequencyLabel } from '@/lib/constants/installment';
import { Loader2 } from 'lucide-react';
import { startNavigationProgress } from '@/lib/utils/navigation';

interface PersonOption {
  id: string;
  fullName: string;
  phone?: string | null;
}

interface LoanFormProps {
  defaultPerson?: PersonOption;
}

export function LoanForm({ defaultPerson }: LoanFormProps) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedPerson, setSelectedPerson] = React.useState<PersonOption | null>(
    defaultPerson ?? null
  );
  const [personSearch, setPersonSearch] = React.useState(defaultPerson?.fullName ?? '');
  const [personResults, setPersonResults] = React.useState<PersonOption[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = React.useState(false);
  const [personSearchError, setPersonSearchError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      personId: defaultPerson?.id ?? '',
      loanAmount: undefined,
      loanDate: getTodayDateString(),
      durationDays: 100,
      dailyInstallment: undefined,
      installmentFrequency: 'DAILY',
      notes: '',
    },
  });

  const enteredAmount = watch('loanAmount');
  const enteredDaily = watch('dailyInstallment');
  const installmentFrequency = watch('installmentFrequency');
  const frequencyLabel = installmentFrequencyLabel(installmentFrequency);

  React.useEffect(() => {
    const query = personSearch.trim();
    if (query.length < 2 || query.toLocaleLowerCase() === selectedPerson?.fullName.toLocaleLowerCase()) {
      setPersonResults([]);
      setPersonSearchError(null);
      setIsSearchingPeople(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingPeople(true);
      setPersonSearchError(null);
      try {
        const response = await fetch(`/api/people/search?q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to search people.');
        const data: { people: PersonOption[] } = await response.json();
        setPersonResults(data.people);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name === 'AbortError') return;
        console.error('Loan person search failed:', searchError);
        setPersonSearchError('Search failed. Please try again.');
      } finally {
        if (!controller.signal.aborted) setIsSearchingPeople(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [personSearch, selectedPerson?.fullName]);

  const selectPerson = (person: PersonOption) => {
    setSelectedPerson(person);
    setPersonSearch(person.fullName);
    setPersonResults([]);
    setValue('personId', person.id, { shouldValidate: true });
  };

  const onSubmit = async (data: LoanFormData) => {
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await createLoanAction({
        personId: data.personId,
        loanAmount: Number(data.loanAmount),
        loanDate: data.loanDate,
        durationDays: data.durationDays ? Number(data.durationDays) : null,
        dailyInstallment: data.dailyInstallment ? Number(data.dailyInstallment) : null,
        installmentFrequency: data.installmentFrequency,
        notes: data.notes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to create loan.');
        setIsSubmitting(false);
        return;
      }

      startNavigationProgress();
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
        <div className="relative space-y-1.5">
          <label htmlFor="person-search" className="block text-sm font-semibold text-slate-700">
            Person / Client *
          </label>
          <input type="hidden" {...register('personId')} />
          <Input
            id="person-search"
            type="search"
            autoComplete="off"
            placeholder="Search name or phone (2+ characters)"
            value={personSearch}
            onChange={(event) => {
              const value = event.target.value;
              setPersonSearch(value);
              setPersonResults([]);
              setPersonSearchError(null);
              if (selectedPerson && value !== selectedPerson.fullName) {
                setSelectedPerson(null);
                setValue('personId', '', { shouldValidate: true });
              }
            }}
            className="h-12"
            aria-describedby="person-search-status"
          />
          {personResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {personResults.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => selectPerson(person)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"
                >
                  <span className="truncate text-sm font-semibold text-slate-800">{person.fullName}</span>
                  {person.phone && <span className="shrink-0 text-xs text-slate-500">{person.phone}</span>}
                </button>
              ))}
            </div>
          )}
          <p id="person-search-status" role={personSearchError ? 'alert' : 'status'} className="flex items-center gap-1.5 text-xs text-slate-500">
            {isSearchingPeople && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
            {personSearchError ||
              (isSearchingPeople
                ? 'Searching...'
                : selectedPerson
                  ? `Selected: ${selectedPerson.fullName}`
                  : personSearch.trim().length >= 2 && personResults.length === 0 && !isSearchingPeople
                    ? 'No matching people found.'
                    : 'Enter at least 2 characters to search.')}
          </p>
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

        <div>
          <Input
            label="Loan Duration (days) *"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="e.g. 100"
            {...register('durationDays', { valueAsNumber: true })}
            error={errors.durationDays?.message}
            hint="Expected end date is calculated automatically from the start date and this duration."
          />
        </div>

        {/* Collection Schedule */}
        <div className="space-y-1.5">
          <label htmlFor="installmentFrequency" className="block text-sm font-semibold text-slate-700">
            Collection Frequency *
          </label>
          <select
            id="installmentFrequency"
            className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            {...register('installmentFrequency')}
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          {errors.installmentFrequency?.message && (
            <p className="text-xs font-medium text-rose-600">{errors.installmentFrequency.message}</p>
          )}
        </div>

        {/* Expected Installment */}
        <div>
          <Input
            label={`Expected ${frequencyLabel[0].toUpperCase()}${frequencyLabel.slice(1)} Installment (₹)`}
            type="number"
            inputMode="numeric"
            placeholder="e.g. 500"
            {...register('dailyInstallment', {
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
            error={errors.dailyInstallment?.message}
            hint={
              enteredDaily && !isNaN(enteredDaily) && enteredDaily > 0
                ? `Expected ${frequencyLabel} collection: ${formatRupeesPlain(enteredDaily)}`
                : `Optional target amount to collect ${frequencyLabel}`
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
