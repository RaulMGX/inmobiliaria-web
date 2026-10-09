'use client';

import { useEffect } from 'react';

export default function BootstrapClient() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).bootstrap) return;
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
      .then((mod) => {
        (window as any).bootstrap = mod.default ?? mod;
        (window as any).bootstrapLoadedAt = Date.now();
        window.dispatchEvent(new CustomEvent('bootstrap:ready'));
      })
      .catch((e: any) => console.error('[bootstrap] bundle failed', e));
  }, []);
  return null;
}
