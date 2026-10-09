'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSession } from '@/lib/api';

type Rol = 'ADMIN' | 'ASESOR';

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  roles?: Rol[];
}

interface MenuGroup {
  section: string;
  items: MenuItem[];
}

const menu: MenuGroup[] = [
  {
    section: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi-speedometer2' },
      { label: 'Clientes', href: '/clientes', icon: 'bi-people' },
      { label: 'Pipeline', href: '/pipeline', icon: 'bi-diagram-3' },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { label: 'Propiedades', href: '/propiedades', icon: 'bi-building', roles: ['ADMIN'] },
      { label: 'Visitas', href: '/visitas', icon: 'bi-calendar-check' },
      { label: 'Reservas', href: '/reservas', icon: 'bi-bookmark-check' },
      { label: 'Ventas', href: '/ventas', icon: 'bi-cart-check' },
    ],
  },
  {
    section: 'Finanzas',
    items: [
      { label: 'Pagos', href: '/pagos', icon: 'bi-cash-coin', roles: ['ADMIN'] },
      { label: 'Contratos', href: '/contratos', icon: 'bi-file-earmark-text', roles: ['ADMIN'] },
      { label: 'Comisiones', href: '/comisiones', icon: 'bi-wallet2', roles: ['ADMIN'] },
    ],
  },
  {
    section: 'Gestión',
    items: [
      { label: 'Usuarios', href: '/usuarios', icon: 'bi-person-badge', roles: ['ADMIN'] },
      { label: 'Reportes', href: '/reportes', icon: 'bi-bar-chart-line', roles: ['ADMIN'] },
      { label: 'Notificaciones', href: '/notificaciones', icon: 'bi-bell' },
      { label: 'Configuración', href: '/configuracion', icon: 'bi-gear', roles: ['ADMIN'] },
    ],
  },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CRM Antony';
  const sess = typeof window !== 'undefined' ? getSession() : null;
  const rol: Rol = (sess?.usuario.rolNombre as Rol) || 'ASESOR';

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'show' : ''}`}
        onClick={onClose}
      />
      <aside className={`crm-sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-icon">
            <i className="bi bi-house-heart-fill" />
          </span>
          <span className="d-none d-md-inline">{appName}</span>
        </div>
        <nav className="nav flex-column">
          {menu.map((group) => {
            const items = group.items.filter((it) => !it.roles || it.roles.includes(rol));
            if (items.length === 0) return null;
            return (
              <div key={group.section}>
                <div className="nav-title d-none d-md-block">{group.section}</div>
                {items.map((it) => {
                  const active =
                    it.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname?.startsWith(it.href);
                  return (
                    <div className="nav-item" key={it.href}>
                      <Link
                        href={it.href}
                        className={`nav-link ${active ? 'active' : ''}`}
                        onClick={onClose}
                      >
                        <i className={`bi ${it.icon}`} />
                        <span className="d-none d-md-inline">{it.label}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
