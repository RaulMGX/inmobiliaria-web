import type { Metadata, Viewport } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.scss';
import BootstrapClient from '@/components/BootstrapClient';
import { Suspense } from 'react';

const APP = process.env.NEXT_PUBLIC_APP_NAME || 'CRM Antony';

export const metadata: Metadata = {
  title: {
    default: `${APP} - Panel`,
    template: `%s · ${APP}`,
  },
  description: 'CRM Inmobiliario multiempresa',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f3c88',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" data-scroll-behavior="smooth">
      <body>
        <Suspense fallback={null}>{children}</Suspense>
        <BootstrapClient />
      </body>
    </html>
  );
}
