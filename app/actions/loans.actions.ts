'use server';

import { revalidatePath } from 'next/cache';
import { createLoan, deleteLoan, updateLoanSchedule } from '@/lib/services/loans.service';
import { loanSchema } from '@/lib/validations/loan';
import { rupeesToPaise } from '@/lib/utils/currency';
import { installmentFrequencies, type InstallmentFrequency } from '@/lib/constants/installment';
import { z } from 'zod';
import { notifyLoanCreated } from '@/lib/services/notifications.service';

export async function createLoanAction(data: {
  personId: string;
  loanAmount: number; // in rupees
  loanDate: string; // YYYY-MM-DD
  durationDays?: number | null;
  dailyInstallment?: number | null; // in rupees
  installmentFrequency: InstallmentFrequency;
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
      durationDays: validated.durationDays,
      dailyInstallmentPaise,
      installmentFrequency: validated.installmentFrequency,
      notes: validated.notes,
    });

    try {
      await notifyLoanCreated(newLoan.id);
    } catch (error) {
      console.error('Loan was created, but its notification could not be saved:', error);
    }

    revalidatePath('/dashboard');
    revalidatePath('/notifications');
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

export async function updateLoanScheduleAction(data: {
  loanId: string;
  installmentAmount: number | null;
  installmentFrequency: InstallmentFrequency;
  durationDays?: number | null;
}) {
  try {
    const validated = z
      .object({
        loanId: z.string().uuid(),
        installmentAmount: z.number().positive().nullable(),
        installmentFrequency: z.enum(installmentFrequencies),
        durationDays: z.number().int().positive().nullable().optional(),
      })
      .parse(data);
    const installmentPaise =
      validated.installmentAmount === null ? null : rupeesToPaise(validated.installmentAmount);
    const updated = await updateLoanSchedule({
      loanId: validated.loanId,
      installmentPaise,
      installmentFrequency: validated.installmentFrequency,
      durationDays: validated.durationDays ?? null,
    });
    revalidatePath('/dashboard');
    revalidatePath('/people');
    revalidatePath('/collections/new');
    revalidatePath(`/loans/${validated.loanId}`);
    return { success: true, loan: updated };
  } catch (err: unknown) {
    console.error('Error updating loan schedule:', err);
    const message = err instanceof Error ? err.message : 'Unable to update loan schedule.';
    return { success: false, error: message };
  }
}
