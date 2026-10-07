import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/shared/Header';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div>
      <Header title="Not Found" backHref="/dashboard" />
      <div className="flex flex-col items-center justify-center p-8 text-center mt-12 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <FileQuestion className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Page Not Found</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          The requested record or screen could not be found.
        </p>
        <Link href="/dashboard">
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
