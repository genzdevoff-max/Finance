'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRupees, formatRupeesPlain, rupeesToPaise } from '@/lib/utils/currency';
import { formatDateDisplay, getTodayDateString } from '@/lib/utils/date';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { createCollectionAction } from '@/app/actions/collections.actions';
import { CheckCircle2, AlertCircle, IndianRupee, Loader2 } from 'lucide-react';
import { installmentFrequencyLabel } from '@/lib/constants/installment';

export interface PersonWithLoansData {
  id: string;
  fullName: string;
  phone: string | null;
  activeLoans: {
    id: string;
    loanAmount: number; // in paise
    loanDate: string;
    dailyInstallment: number | null; // in paise
    installmentFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    remainingAmount: number; // in paise
  }[];
}

interface AddCollectionFormProps {
  people: PersonWithLoansData[];
  initialPersonId?: string;
  initialLoanId?: string;
}

export function AddCollectionForm({
  people: initialPeople,
  initialPersonId,
  initialLoanId,
}: AddCollectionFormProps) {
  const router = useRouter();

  const initialPerson =
    initialPeople.find((person) => person.id === initialPersonId) ??
    (initialPeople.length === 1 ? initialPeople[0] : null);
  const [currentPerson, setCurrentPerson] = React.useState<PersonWithLoansData | null>(initialPerson);
  const [personSearch, setPersonSearch] = React.useState(initialPerson?.fullName ?? '');
  const [personResults, setPersonResults] = React.useState<PersonWithLoansData[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = React.useState(false);
  const [personSearchError, setPersonSearchError] = React.useState<string | null>(null);

  // Selected loan
  const [selectedLoanId, setSelectedLoanId] = React.useState<string>(() => {
    if (initialLoanId) return initialLoanId;
    if (initialPerson && initialPerson.activeLoans.length === 1) {
      return initialPerson.activeLoans[0].id;
    }
    return '';
  });

  React.useEffect(() => {
    const query = personSearch.trim();
    if (query.length < 2 || query.toLocaleLowerCase() === currentPerson?.fullName.toLocaleLowerCase()) {
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
        const response = await fetch(
          `/api/people/active-loans?q=${encodeURIComponent(query)}`,
          { cache: 'no-store', signal: controller.signal }
        );
        if (!response.ok) throw new Error('Unable to search active loans.');
        const data: { people: PersonWithLoansData[] } = await response.json();
        setPersonResults(data.people);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name === 'AbortError') return;
        console.error('Collection borrower search failed:', searchError);
        setPersonSearchError('Search failed. Please try again.');
      } finally {
        if (!controller.signal.aborted) setIsSearchingPeople(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [personSearch, currentPerson?.fullName]);

  const selectPerson = (person: PersonWithLoansData) => {
    setCurrentPerson(person);
    setPersonSearch(person.fullName);
    setPersonResults([]);
    setSelectedLoanId(person.activeLoans.length === 1 ? person.activeLoans[0].id : '');
  };

  // When person changes, auto-select loan if they only have one
  React.useEffect(() => {
    if (currentPerson) {
      if (currentPerson.activeLoans.length === 1) {
        setSelectedLoanId(currentPerson.activeLoans[0].id);
      } else if (!currentPerson.activeLoans.some((l) => l.id === selectedLoanId)) {
        setSelectedLoanId('');
      }
    } else {
      setSelectedLoanId('');
    }
  }, [currentPerson, selectedLoanId]);

  const currentLoan = currentPerson?.activeLoans.find((l) => l.id === selectedLoanId);

  // Amount in rupees
  const [amountStr, setAmountStr] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [collectedDate, setCollectedDate] = React.useState(getTodayDateString);

  // Confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    amount: number;
    personName: string;
    loanId: string;
  } | null>(null);

  // Numeric calculations
  const parsedRupees = parseFloat(amountStr) || 0;
  const parsedPaise = rupeesToPaise(parsedRupees);
  const remainingPaise = currentLoan ? currentLoan.remainingAmount : 0;
  const remainingAfterPaise = Math.max(0, remainingPaise - parsedPaise);

  const isAmountOver = currentLoan ? parsedPaise > remainingPaise : false;
  const isAmountZeroOrNegative = parsedRupees <= 0;
  const isValidToCollect =
    currentPerson && currentLoan && !isAmountZeroOrNegative && !isAmountOver;

  // Fill the expected installment amount for the loan's configured frequency.
  const handleSetInstallmentAmount = () => {
    if (currentLoan?.dailyInstallment) {
      const rs = currentLoan.dailyInstallment / 100;
      setAmountStr(String(rs));
    }
  };

  const handleFullPayoff = () => {
    if (currentLoan) {
      const rs = currentLoan.remainingAmount / 100;
      setAmountStr(String(rs));
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentPerson) {
      setErrorMsg('Please select a person.');
      return;
    }
    if (!selectedLoanId) {
      setErrorMsg('Please select an active loan.');
      return;
    }
    if (isAmountZeroOrNegative) {
      setErrorMsg('Collection amount must be greater than ₹0.');
      return;
    }
    if (isAmountOver) {
      setErrorMsg(
        `Collection cannot be greater than the remaining balance of ${formatRupees(remainingPaise)}.`
      );
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmCollection = async () => {
    if (!currentPerson || !currentLoan) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createCollectionAction({
        personId: currentPerson.id,
        loanId: currentLoan.id,
        amount: parsedRupees,
        collectedAt: collectedDate,
        notes: notes.trim() || undefined,
      });

      setIsSubmitting(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to record collection.');
        setIsConfirmOpen(false);
        return;
      }

      setIsConfirmOpen(false);
      setSuccessInfo({
        amount: parsedRupees,
        personName: currentPerson.fullName,
        loanId: currentLoan.id,
      });
    } catch {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
      setErrorMsg('An unexpected error occurred. Please try again.');
    }
  };

  const handleResetForAnother = () => {
    setSuccessInfo(null);
    setAmountStr('');
    setNotes('');
    setCollectedDate(getTodayDateString());
  };

  // If successfully recorded
  if (successInfo) {
    return (
      <Card className="bg-white p-6 text-center space-y-4 shadow-sm animate-in zoom-in-95 duration-200">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900">
            {formatRupeesPlain(successInfo.amount)} Collected Successfully!
          </h2>
          <p className="text-sm text-slate-600">
            Recorded from <strong className="text-slate-900">{successInfo.personName}</strong>.
            Totals and loan balances updated.
          </p>
        </div>

        <div className="pt-3 flex flex-col gap-2.5">
          <Button onClick={handleResetForAnother} variant="default" size="lg" className="h-12 font-bold">
            Record Another Collection
          </Button>

          <Link href={`/loans/${successInfo.loanId}`}>
            <Button variant="outline" size="default" className="w-full h-11">
              View Loan Details
            </Button>
          </Link>

          <Link href="/dashboard">
            <Button variant="ghost" size="default" className="w-full text-slate-600">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white p-5 shadow-sm space-y-5">
      <form onSubmit={handleOpenConfirm} className="space-y-5">
        {errorMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Select Person */}
        <div className="relative space-y-1.5">
          <label htmlFor="person-search" className="block text-sm font-bold text-slate-800">
            1. Select Person *
          </label>
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
              if (currentPerson && value !== currentPerson.fullName) {
                setCurrentPerson(null);
                setSelectedLoanId('');
              }
            }}
            className="h-12"
            aria-describedby="collection-person-search-status"
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
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{person.fullName}</span>
                    <span className="block text-xs text-slate-500">
                      {person.activeLoans.length} active {person.activeLoans.length === 1 ? 'loan' : 'loans'}
                    </span>
                  </span>
                  {person.phone && <span className="shrink-0 text-xs text-slate-500">{person.phone}</span>}
                </button>
              ))}
            </div>
          )}
          <p id="collection-person-search-status" role={personSearchError ? 'alert' : 'status'} className="flex items-center gap-1.5 text-xs text-slate-500">
            {isSearchingPeople && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
            {personSearchError ||
              (isSearchingPeople
                ? 'Searching...'
                : currentPerson
                  ? `Selected: ${currentPerson.fullName}`
                  : personSearch.trim().length >= 2 && personResults.length === 0 && !isSearchingPeople
                    ? 'No matching people with an active loan found.'
                    : 'Enter at least 2 characters to search.')}
          </p>
          {!isSearchingPeople && personSearch.trim().length >= 2 && personResults.length === 0 && !currentPerson && (
            <Link
              href="/loans/new"
              className="inline-flex text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Create a loan
            </Link>
          )}
        </div>

        {/* STEP 2: Select Active Loan */}
        {currentPerson && (
          <div className="space-y-1.5">
            <label htmlFor="loanSelect" className="block text-sm font-bold text-slate-800">
              2. Select Active Loan *
            </label>
            <select
              id="loanSelect"
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-medium text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Choose active loan...</option>
              {currentPerson.activeLoans.map((loan, idx) => (
                <option key={loan.id} value={loan.id}>
                  Loan #{idx + 1} ({formatDateDisplay(loan.loanDate)}) - Remaining:{' '}
                  {formatRupees(loan.remainingAmount)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loan Balance Preview Banner */}
        {currentLoan && (
          <div className="rounded-2xl bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>CURRENT REMAINING BALANCE</span>
              {currentLoan.dailyInstallment && (
                <span className="text-emerald-400 font-medium">
                  Target: {formatRupees(currentLoan.dailyInstallment)}/{installmentFrequencyLabel(currentLoan.installmentFrequency)}
                </span>
              )}
            </div>

            <div className="text-2xl font-black text-white">
              {formatRupees(currentLoan.remainingAmount)}
            </div>

            {/* Quick helper buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
              {currentLoan.dailyInstallment && (
                <button
                  type="button"
                  onClick={handleSetInstallmentAmount}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition-colors"
                >
                  Fill {installmentFrequencyLabel(currentLoan.installmentFrequency)} ({formatRupees(currentLoan.dailyInstallment)})
                </button>
              )}
              <button
                type="button"
                onClick={handleFullPayoff}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 transition-colors"
              >
                Fill Full Balance
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Enter Amount */}
        {currentLoan && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label htmlFor="amountInput" className="block text-sm font-bold text-slate-800">
                3. Collection Amount (₹) *
              </label>
              <Input
                id="amountInput"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 500"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
                className="text-xl font-bold h-13"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="collectedDate" className="block text-sm font-semibold text-slate-700">
                Actual Collection Date *
              </label>
              <input
                id="collectedDate"
                type="date"
                value={collectedDate}
                max={getTodayDateString()}
                onChange={(event) => setCollectedDate(event.target.value)}
                className="flex h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              {collectedDate < getTodayDateString() && (
                <p className="text-xs font-semibold text-amber-700">
                  This will be marked as a Late Entry.
                </p>
              )}
            </div>

            {/* Live Calculation Feedback */}
            {parsedRupees > 0 && (
              <div
                className={`rounded-2xl p-4 transition-all ${
                  isAmountOver
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                }`}
              >
                {isAmountOver ? (
                  <div className="flex items-start gap-2 text-xs font-semibold text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Collection cannot be greater than the remaining balance of{' '}
                      {formatRupees(remainingPaise)}.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium text-emerald-800">
                      <span>Remaining after this collection:</span>
                      <strong className="text-sm font-black text-emerald-950">
                        {formatRupees(remainingAfterPaise)}
                      </strong>
                    </div>
                    {remainingAfterPaise === 0 && (
                      <p className="text-[11px] font-bold text-emerald-700 pt-1">
                        🎉 This payment will close this loan as COMPLETED!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Optional note */}
            <div className="space-y-1.5">
              <label htmlFor="notes" className="block text-xs font-semibold text-slate-600">
                Optional Note
              </label>
              <input
                id="notes"
                type="text"
                placeholder="e.g. Morning stall visit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {/* Submit / Proceed Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-base font-bold gap-2"
              disabled={!isValidToCollect}
            >
              <IndianRupee className="h-5 w-5 stroke-[2.5]" />
              <span>Confirm & Record Collection</span>
            </Button>
          </div>
        )}
      </form>

      {/* Confirmation Modal */}
      {currentPerson && (
        <Modal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmCollection}
          title={`Collect ${formatRupeesPlain(parsedRupees)}?`}
          description={
            <div className="space-y-2 text-slate-700">
              <p>
                Confirm collecting <strong>{formatRupeesPlain(parsedRupees)}</strong> from{' '}
                <strong>{currentPerson.fullName}</strong>.
              </p>
              <div className="rounded-xl bg-slate-50 p-2.5 text-xs space-y-1">
                <div>
                  Current Remaining: <strong>{formatRupees(remainingPaise)}</strong>
                </div>
                <div>
                  Remaining after: <strong>{formatRupees(remainingAfterPaise)}</strong>
                </div>
              </div>
            </div>
          }
          confirmText="Confirm Collection"
          cancelText="Cancel"
          isLoading={isSubmitting}
        />
      )}
    </Card>
  );
}
