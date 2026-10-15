'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [isNavigating, setIsNavigating] = React.useState(false);

  React.useEffect(() => {
    setIsNavigating(false);
  }, [routeKey]);

  React.useEffect(() => {
    let timeout: number | undefined;

    const start = () => {
      setIsNavigating(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setIsNavigating(false), 10_000);
    };

    const handleLinkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        link.origin !== window.location.origin
      ) {
        return;
      }

      const destination = new URL(link.href);
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }
      start();
    };

    window.addEventListener('finance:navigation-start', start);
    document.addEventListener('click', handleLinkClick, true);
    window.addEventListener('popstate', start);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('finance:navigation-start', start);
      document.removeEventListener('click', handleLinkClick, true);
      window.removeEventListener('popstate', start);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-emerald-100"
      role="status"
      aria-label="Loading screen"
    >
      <div className="h-full w-1/3 animate-navigation-progress rounded-full bg-emerald-600" />
      <span className="sr-only">Loading screen...</span>
    </div>
  );
}
