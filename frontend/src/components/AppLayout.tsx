'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { getSession } from '@/lib/api';

const RUTAS_SOLO_ADMIN = [
  '/usuarios',
  '/reportes',
  '/configuracion',
  '/pagos',
  '/contratos',
  '/comisiones',
  '/propiedades',
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sess = getSession();
    if (!sess) {
      router.replace('/login');
      return;
    }
    const isAdmin = sess.usuario.rolNombre === 'ADMIN';
    if (!isAdmin) {
      const rutaBloqueada = RUTAS_SOLO_ADMIN.some((r) => pathname === r || pathname.startsWith(r + '/'));
      if (rutaBloqueada) {
        router.replace('/dashboard');
        return;
      }
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center text-muted">
        <div className="spinner-border me-2" role="status" aria-hidden="true" />
        Cargando...
      </div>
    );
  }

  return (
    <>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="crm-main-wrap">
        <Navbar onToggleSidebar={() => setOpen((o) => !o)} />
        <main className="crm-content">{children}</main>
      </div>
    </>
  );
}
