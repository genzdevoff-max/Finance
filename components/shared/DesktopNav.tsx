'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BellRing,
  History,
  LayoutDashboard,
  Plus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', href: '/people', icon: Users },
  { label: 'History', href: '/history', icon: History },
  { label: 'Notifications', href: '/notifications', icon: BellRing },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <Link href="/dashboard" className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black text-white">
          F
        </span>
        <span>
          <span className="block text-base font-extrabold tracking-tight text-slate-900">
            Finance Tracker
          </span>
          <span className="block text-xs font-medium text-slate-500">Loans & collections</span>
        </span>
      </Link>

      <nav aria-label="Main Navigation" className="flex-1 space-y-1 px-4 py-6">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === '/dashboard'
              ? pathname === '/' || pathname.startsWith('/dashboard')
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <Link
          href="/collections/new"
          prefetch={false}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-5 w-5" />
          Add Collection
        </Link>
      </div>
    </aside>
  );
}
