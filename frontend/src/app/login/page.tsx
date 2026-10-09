'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { http, saveSession } from '@/lib/api';
import type { LoginResponse } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const app = process.env.NEXT_PUBLIC_APP_NAME || 'CRM Antony';
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await http.post<LoginResponse>('/auth/login', { correo, password });
      saveSession({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        usuario: res.data.usuario,
      });
      router.replace('/dashboard');
    } catch (err) {
      const e = err as AxiosError<any>;
      if (!e.response) {
        setError(
          'No se pudo conectar con el servidor. Asegúrate que el backend esté corriendo en http://localhost:3000 y recarga la página.',
        );
      } else {
        const status = e.response.status;
        const message = e.response?.data?.message;
        if (status === 401) {
          setError(typeof message === 'string' ? message : 'Credenciales inválidas, por favor inténtalo nuevamente.');
        } else if (Array.isArray(message)) {
          setError(message[0] ?? 'Ocurrió un error al iniciar sesión.');
        } else {
          setError(typeof message === 'string' && message ? message : 'Ocurrió un error al iniciar sesión.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="text-center mb-4">
          <div className="d-inline-flex align-items-center justify-content-center mb-3 brand-icon" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#1f3c88,#f39200)', color: '#fff', fontSize: '1.5rem' }}>
            <i className="bi bi-house-heart-fill" />
          </div>
          <h1 className="h4 fw-bold mb-1">{app}</h1>
          <p className="text-muted small mb-0">Inicia sesión para continuar</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-start gap-2 small py-2" role="alert">
            <i className="bi bi-exclamation-triangle-fill mt-1" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={onSubmit} className="needs-validation" noValidate>
          <div className="mb-3">
            <label htmlFor="correo" className="form-label small fw-semibold">
              Correo electrónico
            </label>
            <div className="input-group">
              <span className="input-group-text bg-white text-muted">
                <i className="bi bi-envelope" />
              </span>
              <input
                id="correo"
                type="email"
                className="form-control"
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="asesor@empresa.com"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label small fw-semibold">
              Contraseña
            </label>
            <div className="input-group">
              <span className="input-group-text bg-white text-muted">
                <i className="bi bi-lock" />
              </span>
              <input
                id="password"
                type="password"
                className="form-control"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-4 small">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="remember" />
              <label className="form-check-label text-muted" htmlFor="remember">
                Recordarme
              </label>
            </div>
            <Link href="#" className="text-decoration-none fw-semibold" style={{ color: '#1f3c88' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn w-100 py-2 fw-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#1f3c88,#152c63)', border: 0 }}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                Ingresando...
              </>
            ) : (
              <>Iniciar sesión</>
            )}
          </button>
        </form>

        <p className="text-center text-muted small mt-4 mb-0">
          © {new Date().getFullYear()} {app}. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
