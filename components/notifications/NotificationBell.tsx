'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Loader2 } from 'lucide-react';

export function NotificationBell() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const refreshCount = async () => {
      if (active) setIsLoading(true);
      try {
        const response = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to refresh notifications.');
        const result: { count: number } = await response.json();
        if (active) setUnreadCount(result.count);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const refreshWithLogging = () => {
      void refreshCount().catch((error: unknown) => {
        console.error('Failed to refresh notification badge:', error);
      });
    };

    refreshWithLogging();
    const interval = window.setInterval(refreshWithLogging, 60_000);
    window.addEventListener('notifications-updated', refreshWithLogging);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('notifications-updated', refreshWithLogging);
    };
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      prefetch={false}
      aria-label={
        isLoading
          ? 'Loading notifications'
          : unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
      }
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
    >
      {isLoading ? (
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-emerald-700" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
