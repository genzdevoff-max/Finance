import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/shared/BottomNav';
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'Mobile-first Finance Tracker application',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinanceTracker',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        {/* Mobile viewport container */}
        <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-xl shadow-slate-200/50">
          <main className="flex-1 pb-24">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
