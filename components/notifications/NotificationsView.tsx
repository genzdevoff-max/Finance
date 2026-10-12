'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellRing, Check } from 'lucide-react';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions/notifications.actions';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';

interface NotificationItem {
  id: string;
  type: string;
  personId: string | null;
  loanId: string | null;
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
}

export function NotificationsView({
  items,
  currentPage,
  totalPages,
  unreadCount,
}: {
  items: NotificationItem[];
  currentPage: number;
  totalPages: number;
  unreadCount: number;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = React.useState(false);

  const markRead = async (id: string) => {
    setUpdatingId(id);
    setError(null);
    const result = await markNotificationReadAction(id);
    setUpdatingId(null);
    if (!result.success) {
      setError(result.error || 'Unable to mark notification as read.');
      return;
    }
    window.dispatchEvent(new Event('notifications-updated'));
    router.refresh();
  };

  const markAllRead = async () => {
    setIsMarkingAllRead(true);
    setError(null);
    try {
      const result = await markAllNotificationsReadAction();
      if (!result.success) {
        setError(result.error || 'Unable to mark notifications as read.');
        return;
      }
      window.dispatchEvent(new Event('notifications-updated'));
      router.refresh();
    } catch (markAllError) {
      console.error('Failed to mark all notifications as read:', markAllError);
      setError('Unable to mark notifications as read. Please try again.');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">
          {unreadCount > 0
            ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
            : 'All notifications are read'}
        </p>
        <button
          type="button"
          disabled={unreadCount === 0 || isMarkingAllRead}
          onClick={() => void markAllRead()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {isMarkingAllRead ? 'Marking all read…' : 'Mark all as read'}
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No notifications"
          description="Loan due dates, repayments, and new loan activity will appear here."
        />
      ) : (
        items.map((item) => (
          <Card
            key={item.id}
            className={`flex items-start gap-3 p-3.5 ${
              item.readAt ? 'bg-white' : 'border-emerald-200 bg-emerald-50/60'
            }`}
          >
            <BellRing
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                item.readAt ? 'text-slate-400' : 'text-emerald-700'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 break-words text-xs text-slate-600">{item.message}</p>
              {item.loanId && (
                <Link
                  href={`/loans/${item.loanId}`}
                  className="mt-2 inline-block text-xs font-bold text-emerald-800 hover:underline"
                >
                  View loan
                </Link>
              )}
            </div>
            {item.readAt ? (
              <span className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400">
                Read
              </span>
            ) : (
              <button
                type="button"
                aria-label="Mark notification as read"
                disabled={updatingId === item.id || isMarkingAllRead}
                onClick={() => void markRead(item.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {updatingId === item.id ? 'Saving…' : 'Mark as read'}
              </button>
            )}
          </Card>
        ))
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 py-2">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={currentPage <= 1}
              tabIndex={currentPage <= 1 ? -1 : undefined}
              href={currentPage > 1 ? `/notifications?page=${currentPage - 1}` : '/notifications'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                currentPage <= 1
                  ? 'pointer-events-none border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Previous
            </Link>
            <Link
              aria-disabled={currentPage >= totalPages}
              tabIndex={currentPage >= totalPages ? -1 : undefined}
              href={`/notifications?page=${Math.min(currentPage + 1, totalPages)}`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                currentPage >= totalPages
                  ? 'pointer-events-none border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
