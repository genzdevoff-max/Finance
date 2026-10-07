'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/shared/Header';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div>
      <Header title="Error" backHref="/dashboard" />
      <div className="flex flex-col items-center justify-center p-8 text-center mt-12 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-600 max-w-xs">
          Unable to process this action. Please check your database connection or try again.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
          <Button onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
