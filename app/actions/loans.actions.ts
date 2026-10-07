'use server';

import { revalidatePath } from 'next/cache';
import { createLoan, deleteLoan } from '@/lib/services/loans.service';
import { loanSchema } from '@/lib/validations/loan';
import { rupeesToPaise } from '@/lib/utils/currency';

export async function createLoanAction(data: {
  personId: string;
  loanAmount: number; // in rupees
  loanDate: string; // YYYY-MM-DD
  dailyInstallment?: number | null; // in rupees
  notes?: string | null;
}) {
  try {
    const validated = loanSchema.parse(data);

    const loanAmountPaise = rupeesToPaise(validated.loanAmount);
    const dailyInstallmentPaise = validated.dailyInstallment
      ? rupeesToPaise(validated.dailyInstallment)
      : null;

    const newLoan = await createLoan({
      personId: validated.personId,
      loanAmountPaise,
      loanDate: validated.loanDate,
      dailyInstallmentPaise,
      notes: validated.notes,
    });

    revalidatePath('/dashboard');
    revalidatePath('/people');
    revalidatePath(`/people/${validated.personId}`);

    return { success: true, loan: newLoan };
  } catch (err: unknown) {
    console.error('Error creating loan:', err);
    const message = err instanceof Error ? err.message : 'Unable to create loan. Please try again.';
    return { success: false, error: message };
  }
}

export async function deleteLoanAction(loanId: string, personId: string) {
  try {
    await deleteLoan(loanId);
    revalidatePath('/dashboard');
    revalidatePath('/people');
    revalidatePath(`/people/${personId}`);
    revalidatePath('/history');
    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting loan:', err);
    return { success: false, error: 'Unable to delete loan. Please try again.' };
  }
}
