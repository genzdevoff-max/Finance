'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, History, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      isActive: pathname === '/' || pathname === '/dashboard',
    },
    {
      label: 'People',
      href: '/people',
      icon: Users,
      isActive: pathname.startsWith('/people'),
    },
    {
      label: 'History',
      href: '/history',
      icon: History,
      isActive: pathname.startsWith('/history'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-3 py-2">
        {/* Dashboard link */}
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 text-xs font-semibold transition-colors',
            navItems[0].isActive
              ? 'text-emerald-700'
              : 'text-slate-500 hover:text-slate-900'
          )}
        >
          <LayoutDashboard
            className={cn('h-6 w-6 stroke-[2]', navItems[0].isActive && 'stroke-[2.5]')}
          />
          <span className="mt-1">Dashboard</span>
        </Link>

        {/* Prominent Add Collection button */}
        <div className="flex flex-col items-center justify-center px-2">
          <Link
            href="/collections/new"
            aria-label="Add Collection"
            className="flex h-13 w-13 -mt-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white active:scale-95 transition-all hover:bg-emerald-700"
          >
            <Plus className="h-7 w-7 stroke-[2.5]" />
          </Link>
          <span className="text-[10px] font-bold text-emerald-800 mt-1">Collect</span>
        </div>

        {/* People link */}
        <Link
          href="/people"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 text-xs font-semibold transition-colors',
            navItems[1].isActive
              ? 'text-emerald-700'
              : 'text-slate-500 hover:text-slate-900'
          )}
        >
          <Users
            className={cn('h-6 w-6 stroke-[2]', navItems[1].isActive && 'stroke-[2.5]')}
          />
          <span className="mt-1">People</span>
        </Link>

        {/* History link */}
        <Link
          href="/history"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 text-xs font-semibold transition-colors',
            navItems[2].isActive
              ? 'text-emerald-700'
              : 'text-slate-500 hover:text-slate-900'
          )}
        >
          <History
            className={cn('h-6 w-6 stroke-[2]', navItems[2].isActive && 'stroke-[2.5]')}
          />
          <span className="mt-1">History</span>
        </Link>
      </div>
    </nav>
  );
}
