'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { startNavigationProgress } from '@/lib/utils/navigation';

interface HeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, backHref, onBack, action }: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      startNavigationProgress();
      router.push(backHref);
    } else {
      startNavigationProgress();
      router.back();
    }
  };

  const showBackButton = !!backHref || !!onBack;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 pt-safe backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showBackButton && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h1>
            {subtitle && <p className="truncate text-xs text-slate-500 font-medium">{subtitle}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell />
          {action}
        </div>
      </div>
    </header>
  );
}
