'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('ServiceWorker registration successful with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('ServiceWorker registration failed:', err);
        });
    }
  }, []);

  return null;
}
