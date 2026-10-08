'use server';

import { revalidatePath } from 'next/cache';
import { createPerson, updatePerson, deletePerson } from '@/lib/services/people.service';
import { personSchema } from '@/lib/validations/person';

export async function createPersonAction(data: {
  fullName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  try {
    const validated = personSchema.parse(data);
    const newPerson = await createPerson(validated);
    revalidatePath('/people');
    revalidatePath('/dashboard');
    return {
      success: true,
      person: {
        id: newPerson.id,
        fullName: newPerson.fullName,
        phone: newPerson.phone,
        address: newPerson.address,
        notes: newPerson.notes,
      },
    };
  } catch (err: unknown) {
    console.error('Error creating person:', err);
    const message = err instanceof Error ? err.message : 'Unable to add person. Please try again.';
    return { success: false, error: message };
  }
}

export async function updatePersonAction(
  id: string,
  data: {
    fullName: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  }
) {
  try {
    const validated = personSchema.parse(data);
    const updated = await updatePerson(id, validated);
    revalidatePath('/people');
    revalidatePath(`/people/${id}`);
    revalidatePath('/dashboard');
    return {
      success: true,
      person: {
        id: updated.id,
        fullName: updated.fullName,
        phone: updated.phone,
        address: updated.address,
        notes: updated.notes,
      },
    };
  } catch (err: unknown) {
    console.error('Error updating person:', err);
    const message = err instanceof Error ? err.message : 'Unable to update person. Please try again.';
    return { success: false, error: message };
  }
}

export async function deletePersonAction(id: string) {
  try {
    await deletePerson(id);
    revalidatePath('/people');
    revalidatePath('/dashboard');
    revalidatePath('/history');
    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting person:', err);
    return { success: false, error: 'Unable to delete person. Please try again.' };
  }
}
