import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionHref?: string;
  actionText?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionHref,
  actionText,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center animate-in fade-in duration-200">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-3">
        <Icon className="h-7 w-7 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-xs">{description}</p>}
      {actionHref && actionText && (
        <div className="mt-5">
          <Link href={actionHref}>
            <Button size="sm" variant="default">
              {actionText}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
