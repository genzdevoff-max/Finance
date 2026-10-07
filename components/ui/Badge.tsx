import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'active' | 'completed' | 'neutral' | 'warning';
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  const variants = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200/60 font-semibold',
    completed: 'bg-slate-100 text-slate-700 border-slate-200 font-semibold',
    warning: 'bg-amber-100 text-amber-800 border-amber-200 font-semibold',
    neutral: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs tracking-wide transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
