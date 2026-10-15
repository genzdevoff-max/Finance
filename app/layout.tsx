import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/shared/BottomNav';
import { DesktopNav } from '@/components/shared/DesktopNav';
import { NavigationProgress } from '@/components/shared/NavigationProgress';
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'Responsive Finance Tracker for loans and collections',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinanceTracker',
  },
  icons: {
    icon: '/icons/finance-icon-192-v2.png',
    apple: '/icons/finance-apple-icon-v2.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-100">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full bg-slate-100 antialiased font-sans text-slate-900 selection:bg-emerald-100">
        <ServiceWorkerRegister />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <div className="min-h-screen bg-slate-100 lg:pl-64">
          <DesktopNav />
          <main className="min-h-screen bg-slate-50 pb-24 lg:pb-8">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
