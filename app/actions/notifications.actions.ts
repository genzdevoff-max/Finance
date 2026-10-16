'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth/server';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/services/notifications.service';

export async function markNotificationReadAction(id: string) {
  if (!(await isAuthenticated())) return { success: false, error: 'Unauthorized.' };

  try {
    await markNotificationRead(id);
    revalidatePath('/notifications');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to update notification.',
    };
  }
}

export async function markAllNotificationsReadAction() {
  if (!(await isAuthenticated())) return { success: false, error: 'Unauthorized.' };

  try {
    await markAllNotificationsRead();
    revalidatePath('/notifications');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to update notifications.',
    };
  }
}
