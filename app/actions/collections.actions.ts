'use server';

import { revalidatePath } from 'next/cache';
import {
  createCollection,
  updateCollection,
  deleteCollection,
} from '@/lib/services/collections.service';
import { collectionSchema } from '@/lib/validations/collection';
import { rupeesToPaise } from '@/lib/utils/currency';
import { getTodayDateString, parseDateString } from '@/lib/utils/date';
import { notifyLoanCompleted } from '@/lib/services/notifications.service';

export async function createCollectionAction(data: {
  personId: string;
  loanId: string;
  amount: number; // in rupees
  collectedAt?: string | null;
  notes?: string | null;
}) {
  try {
    const validated = collectionSchema.parse(data);
    const amountPaise = rupeesToPaise(validated.amount);

    const collectedAtDate = validated.collectedAt
      ? parseDateString(validated.collectedAt)
      : new Date();
    if (validated.collectedAt && !collectedAtDate) {
      return { success: false, error: 'Collection date is invalid.' };
    }

    const newCollection = await createCollection({
      personId: validated.personId,
      loanId: validated.loanId,
      amountPaise,
      collectedAt: collectedAtDate,
      notes: validated.notes,
    });

    if (newCollection.completed) {
      try {
        await notifyLoanCompleted(validated.loanId);
      } catch (error) {
        console.error('Loan was repaid, but its notification could not be saved:', error);
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    revalidatePath('/history');
    revalidatePath('/people');
    revalidatePath(`/people/${validated.personId}`);
    revalidatePath(`/loans/${validated.loanId}`);

    return { success: true, collection: newCollection };
  } catch (err: unknown) {
    console.error('Error recording collection:', err);
    const message =
      err instanceof Error ? err.message : 'Unable to record this collection. Please try again.';
    return { success: false, error: message };
  }
}

export async function updateCollectionAction(
  collectionId: string,
  data: {
    amount: number; // in rupees
    collectedAt?: string | null;
    notes?: string | null;
    loanId?: string;
    personId?: string;
  }
) {
  try {
    if (!data.amount || data.amount <= 0) {
      return { success: false, error: 'Collection amount must be greater than ₹0.' };
    }

    const amountPaise = rupeesToPaise(data.amount);
    const collectedAtDate = data.collectedAt ? parseDateString(data.collectedAt) : undefined;
    if (
      data.collectedAt &&
      (!collectedAtDate || data.collectedAt > getTodayDateString())
    ) {
      return { success: false, error: 'Choose a valid collection date that is not in the future.' };
    }

    const updated = await updateCollection(collectionId, {
      amountPaise,
      collectedAt: collectedAtDate,
      notes: data.notes,
    });

    if (updated.completed) {
      try {
        await notifyLoanCompleted(updated.loanId);
      } catch (error) {
        console.error('Loan was updated, but its completion notification could not be saved:', error);
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    revalidatePath('/history');
    revalidatePath('/people');
    if (data.personId) revalidatePath(`/people/${data.personId}`);
    if (data.loanId) revalidatePath(`/loans/${data.loanId}`);

    return { success: true, collection: updated };
  } catch (err: unknown) {
    console.error('Error updating collection:', err);
    const message =
      err instanceof Error ? err.message : 'Unable to update this collection. Please try again.';
    return { success: false, error: message };
  }
}

export async function deleteCollectionAction(
  collectionId: string,
  meta?: { loanId?: string; personId?: string }
) {
  try {
    await deleteCollection(collectionId);

    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    revalidatePath('/history');
    revalidatePath('/people');
    if (meta?.personId) revalidatePath(`/people/${meta.personId}`);
    if (meta?.loanId) revalidatePath(`/loans/${meta.loanId}`);

    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting collection:', err);
    return {
      success: false,
      error: 'Unable to delete this collection. Please try again.',
    };
  }
}
