'use client';

import '../list.scss';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDate, getSession, http, initials, saveSession } from '@/lib/api';
import type { UserSession } from '@/lib/types';

interface MeUsuario {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  rolId: string;
  empresaId: string;
  rolNombre: 'ADMIN' | 'ASESOR';
  rol?: { id: string; nombre: string; descripcion: string | null } | null;
}

function pwdOk(p: string) {
  if (!p || p.length < 8) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/[a-z]/.test(p)) return false;
  if (!/\d/.test(p)) return false;
  if (!/[^\p{L}\p{N}]/u.test(p)) return false;
  return true;
}

export default function PerfilPage() {
  const sess = getSession() as UserSession | null;

  const [me, setMe] = useState<MeUsuario | null>(null);
  const [loadMe, setLoadMe] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [uForm, setUForm] = useState({ nombres: '', apellidos: '', correo: '', telefono: '' });
  const [uMsg, setUMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uSaving, setUSaving] = useState(false);

  const [pwd, setPwd] = useState({ actualPassword: '', password: '', confirmPassword: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      if (!sess) return;
      setUForm({
        nombres: sess.usuario.nombres,
        apellidos: sess.usuario.apellidos,
        correo: sess.usuario.correo,
        telefono: sess.usuario.telefono || '',
      });
      try {
        setLoadMe(true);
        const { data } = await http.get<MeUsuario>('/auth/me');
        setMe(data);
        setUForm({
          nombres: data.nombres,
          apellidos: data.apellidos,
          correo: data.correo,
          telefono: data.telefono || '',
        });
      } catch (e) {
        const ae = e as AxiosError<any>;
        setErr(ae.response?.data?.message ?? 'No se pudo cargar la información del usuario.');
      } finally {
        setLoadMe(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setUSaving(true);
    setUMsg(null);
    try {
      const { data } = await http.patch<MeUsuario>('/auth/me', {
        nombres: uForm.nombres.trim() || undefined,
        apellidos: uForm.apellidos.trim() || undefined,
        correo: uForm.correo.trim() || undefined,
        telefono: uForm.telefono.trim() || undefined,
      });
      const sessNow = getSession();
      if (sessNow) {
        const updated: UserSession = {
          ...sessNow,
          usuario: {
            ...sessNow.usuario,
            nombres: data.nombres,
            apellidos: data.apellidos,
            correo: data.correo,
            telefono: data.telefono,
          },
        };
        saveSession(updated);
      }
      setMe(data);
      setUMsg({ ok: true, text: 'Perfil actualizado correctamente.' });
    } catch (e) {
      const ae = e as AxiosError<any>;
      setUMsg({ ok: false, text: ae.response?.data?.message ?? 'No se pudo guardar el perfil.' });
    } finally {
      setUSaving(false);
    }
  }

  async function guardarContrasena(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (!pwd.actualPassword) { setPwdMsg({ ok: false, text: 'Ingresa tu contraseña actual.' }); return; }
    if (!pwdOk(pwd.password)) { setPwdMsg({ ok: false, text: 'La nueva contraseña no cumple las reglas (mín. 8, mayús., minús., número y símbolo).' }); return; }
    if (pwd.password !== pwd.confirmPassword) { setPwdMsg({ ok: false, text: 'La confirmación de la contraseña no coincide.' }); return; }
    setPwdSaving(true);
    try {
      const { data } = await http.patch<any>('/auth/me/password', pwd);
      setPwd({ actualPassword: '', password: '', confirmPassword: '' });
      setPwdMsg({ ok: true, text: data?.message || 'Contraseña actualizada correctamente.' });
    } catch (e) {
      const ae = e as AxiosError<any>;
      setPwdMsg({ ok: false, text: ae.response?.data?.message ?? 'No se pudo actualizar la contraseña.' });
    } finally {
      setPwdSaving(false);
    }
  }

  const avatar = me || sess?.usuario;
  const rolTxt = me?.rolNombre || sess?.usuario.rolNombre || '—';
  const rolBadge = rolTxt === 'ADMIN' ? 'badge-soft-primary' : 'badge-soft-warning';

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="page-subtitle">Visualiza y actualiza tus datos personales de acceso al CRM.</p>
        </div>
      </div>

      {err && <div className="alert alert-danger small mb-3 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{err}</div></div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="section-card mb-3">
            <div className="card-header"><h5 className="card-title"><i className="bi bi-person-badge me-2 text-primary" /> Perfil</h5></div>
            <div className="card-body text-center">
              {loadMe && !me ? (
                <div className="py-4 text-center text-muted"><div className="spinner-border spinner-border-sm me-2" /> Cargando...</div>
              ) : (
                <>
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle text-white fw-bold mb-2"
                    style={{ width: 72, height: 72, fontSize: '1.6rem', background: 'linear-gradient(135deg,#1f3c88,#f39200)' }}
                  >
                    {avatar?.avatar ? (
                      <img src={avatar.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <span>{initials(avatar?.nombres || 'U', avatar?.apellidos)}</span>
                    )}
                  </div>
                  <div className="fw-semibold">{avatar?.nombres} {avatar?.apellidos}</div>
                  <div className="text-muted small">{avatar?.correo}</div>
                  <div className="d-flex align-items-center justify-content-center gap-2 mt-2">
                    <span className={`badge ${rolBadge} fw-semibold`} style={{ fontSize: '.72rem' }}>{rolTxt}</span>
                    <span className="text-muted small" style={{ fontSize: '.72rem' }}>Creado: {formatDate(avatar?.createdAt)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="card-header"><h5 className="card-title"><i className="bi bi-info-circle me-2 text-info" /> Resumen</h5></div>
            <ul className="list-group list-group-flush small">
              <li className="list-group-item d-flex justify-content-between"><span className="text-muted">Empresa ID</span><span className="fw-semibold" style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{(me?.empresaId || sess?.usuario.empresaId || '—').slice(0, 12)}…</span></li>
              <li className="list-group-item d-flex justify-content-between"><span className="text-muted">Rol</span><span className="fw-semibold">{rolTxt}</span></li>
              <li className="list-group-item d-flex justify-content-between"><span className="text-muted">Última actualización</span><span className="fw-semibold">{formatDate(me?.updatedAt || avatar?.createdAt)}</span></li>
              <li className="list-group-item d-flex justify-content-between"><span className="text-muted">API Base</span><span className="fw-semibold text-truncate" style={{ maxWidth: 160, fontFamily: 'monospace', fontSize: '.7rem' }}>{(http.defaults.baseURL || '—').toString()}</span></li>
            </ul>
          </div>
        </div>

        <div className="col-lg-8">
          <form onSubmit={guardarUsuario} className="section-card mb-3">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h5 className="card-title"><i className="bi bi-person-fill-gear me-2 text-primary" /> Datos del usuario</h5>
              <button className="btn btn-sm btn-primary d-flex align-items-center gap-2" type="submit" disabled={uSaving || loadMe}>
                {uSaving && <span className="spinner-border spinner-border-sm" />}
                <i className="bi bi-save" /> Guardar perfil
              </button>
            </div>
            <div className="card-body">
              {uMsg && <div className={`alert small mb-3 d-flex align-items-start gap-2 py-2 ${uMsg.ok ? 'alert-success' : 'alert-danger'}`} role="alert"><i className={`bi ${uMsg.ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} mt-1`} /><div>{uMsg.text}</div></div>}
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Nombres</label>
                  <input className="form-control" value={uForm.nombres} onChange={(e) => setUForm((f) => ({ ...f, nombres: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Apellidos</label>
                  <input className="form-control" value={uForm.apellidos} onChange={(e) => setUForm((f) => ({ ...f, apellidos: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Correo electrónico</label>
                  <input type="email" className="form-control" value={uForm.correo} onChange={(e) => setUForm((f) => ({ ...f, correo: e.target.value }))} required readOnly title="Solo el administrador puede cambiar el correo." />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Teléfono</label>
                  <input className="form-control" value={uForm.telefono} onChange={(e) => setUForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="+51 987 654 321" />
                </div>
              </div>
            </div>
          </form>

          <form onSubmit={guardarContrasena} className="section-card mb-3">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h5 className="card-title"><i className="bi bi-shield-lock me-2 text-success" /> Cambiar contraseña</h5>
              <button className="btn btn-sm btn-success d-flex align-items-center gap-2" type="submit" disabled={pwdSaving}>
                {pwdSaving && <span className="spinner-border spinner-border-sm" />}
                <i className="bi bi-key-fill" /> Actualizar contraseña
              </button>
            </div>
            <div className="card-body">
              {pwdMsg && <div className={`alert small mb-3 d-flex align-items-start gap-2 py-2 ${pwdMsg.ok ? 'alert-success' : 'alert-danger'}`} role="alert"><i className={`bi ${pwdMsg.ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} mt-1`} /><div>{pwdMsg.text}</div></div>}
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small fw-semibold">Contraseña actual</label>
                  <input type="password" className="form-control" value={pwd.actualPassword} onChange={(e) => setPwd((p) => ({ ...p, actualPassword: e.target.value }))} placeholder="Tu contraseña actual" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Nueva contraseña</label>
                  <input type="password" className="form-control" value={pwd.password} onChange={(e) => setPwd((p) => ({ ...p, password: e.target.value }))} placeholder="Mín. 8, mayús., minús., número y símbolo" required />
                  <div className="form-text small text-muted">8+ caracteres, una mayúscula, una minúscula, un número y un símbolo.</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Confirmar nueva contraseña</label>
                  <input type="password" className="form-control" value={pwd.confirmPassword} onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repite la nueva contraseña" required />
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
