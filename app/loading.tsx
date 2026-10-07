import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="p-4 space-y-4">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>

      {/* Main card skeleton */}
      <Skeleton className="h-44 w-full rounded-3xl" />

      {/* Action button skeleton */}
      <Skeleton className="h-14 w-full rounded-xl" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>

      {/* List items skeleton */}
      <div className="space-y-2 pt-2">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}
