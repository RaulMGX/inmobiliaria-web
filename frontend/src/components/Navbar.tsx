'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearSession, formatDate, getSession, initials } from '@/lib/api';
import type { UserSession } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function Navbar({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const user = session?.usuario;
  const isAdmin = user?.rolNombre === 'ADMIN';

  return (
    <nav className="crm-navbar navbar navbar-expand px-0">
      <div className="container-fluid px-3">
        <div className="d-flex align-items-center gap-2">
          <button
            className="crm-sidebar-toggle btn btn-light btn-sm border me-1"
            onClick={onToggleSidebar}
            type="button"
            aria-label="Abrir menú"
          >
            <i className="bi bi-list fs-5" />
          </button>
          <div>
            <div className="page-title mb-0 fs-5 d-none d-sm-block">
              Panel de control
            </div>
            <div className="page-subtitle d-none d-md-block">
              {formatDate(new Date())}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 ms-auto">
          <button className="btn btn-sm btn-outline-secondary border-0 position-relative" type="button">
            <i className="bi bi-bell fs-5" />
            <span className="position-absolute top-0 end-0 translate-middle-y badge rounded-pill bg-danger mt-1">
              3
            </span>
          </button>
          <button className="btn btn-sm btn-outline-secondary border-0" type="button">
            <i className="bi bi-chat-dots fs-5" />
          </button>

          <div className="dropdown ms-2">
            <button
              className="btn btn-white d-flex align-items-center gap-2 dropdown-toggle border shadow-none"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <span className="avatar-sm text-bg-primary">
                {user ? initials(user.nombres, user.apellidos) : '?'}
              </span>
              <span className="d-none d-md-flex flex-column align-items-start lh-1">
                <span className="fw-semibold small">
                  {user ? `${user.nombres} ${user.apellidos}` : 'Usuario'}
                </span>
                <span className="text-muted" style={{ fontSize: '.7rem' }}>
                  {user?.rolNombre === 'ADMIN' ? 'Administrador' : 'Asesor'}
                </span>
              </span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow-sm mt-2">
              <li>
                <Link className="dropdown-item" href="/configuracion/perfil">
                  <i className="bi bi-person me-2" /> Mi perfil
                </Link>
              </li>
              {isAdmin && (
                <li>
                  <Link className="dropdown-item" href="/configuracion">
                    <i className="bi bi-gear me-2" /> Configuración
                  </Link>
                </li>
              )}
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button
                  className="dropdown-item text-danger"
                  onClick={() => {
                    clearSession();
                    router.push('/login');
                  }}
                >
                  <i className="bi bi-box-arrow-right me-2" /> Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
