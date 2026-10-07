import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none rounded-xl';

    const variants = {
      default: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-700/20',
      secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200',
      outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-700/20',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      success: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    };

    const sizes = {
      default: 'h-11 px-4 py-2 text-base',
      sm: 'h-9 px-3 text-sm rounded-lg',
      lg: 'h-13 px-6 text-lg rounded-2xl font-semibold',
      icon: 'h-11 w-11 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
