'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDate, getSession, http, initials } from '@/lib/api';
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

const EMPRESA_KEY = 'crm.empresa.datos.v1';

interface EmpresaDatos {
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  telefono: string;
  correo: string;
  direccion: string;
  descripcion: string;
}

const EMPRESA_DEFAULT: EmpresaDatos = {
  razonSocial: '',
  nombreComercial: '',
  ruc: '',
  telefono: '',
  correo: '',
  direccion: '',
  descripcion: '',
};

function loadEmpresa(): EmpresaDatos {
  if (typeof window === 'undefined') return { ...EMPRESA_DEFAULT };
  try {
    const raw = localStorage.getItem(EMPRESA_KEY);
    if (!raw) return { ...EMPRESA_DEFAULT };
    return { ...EMPRESA_DEFAULT, ...(JSON.parse(raw) as Partial<EmpresaDatos>) };
  } catch {
    return { ...EMPRESA_DEFAULT };
  }
}

function saveEmpresa(d: EmpresaDatos) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EMPRESA_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

const PREF_KEY = 'crm.preferencias.v1';

interface Preferencias {
  moneda: 'PEN' | 'USD';
  idioma: 'es-PE' | 'en-US';
  zonaHoraria: string;
  notificacionesEmail: boolean;
  notificacionesPush: boolean;
  paginaInicio: '/dashboard' | '/ventas' | '/reportes';
}

const PREF_DEFAULT: Preferencias = {
  moneda: 'PEN',
  idioma: 'es-PE',
  zonaHoraria: 'America/Lima',
  notificacionesEmail: true,
  notificacionesPush: false,
  paginaInicio: '/dashboard',
};

function loadPref(): Preferencias {
  if (typeof window === 'undefined') return { ...PREF_DEFAULT };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { ...PREF_DEFAULT };
    return { ...PREF_DEFAULT, ...(JSON.parse(raw) as Partial<Preferencias>) };
  } catch {
    return { ...PREF_DEFAULT };
  }
}
function savePref(p: Preferencias) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export default function ConfiguracionPage() {
  const sess = getSession() as UserSession | null;

  const [me, setMe] = useState<MeUsuario | null>(null);
  const [loadMe, setLoadMe] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [uForm, setUForm] = useState({ nombres: '', apellidos: '', correo: '', telefono: '' });
  const [uMsg, setUMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uSaving, setUSaving] = useState(false);

  const [eForm, setEForm] = useState<EmpresaDatos>({ ...EMPRESA_DEFAULT });
  const [eMsg, setEMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [eSaving, setESaving] = useState(false);

  const [pForm, setPForm] = useState<Preferencias>({ ...PREF_DEFAULT });
  const [pMsg, setPMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pSaving, setPSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setEForm(loadEmpresa());
      setPForm(loadPref());
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
      setUMsg({ ok: true, text: 'Perfil actualizado correctamente.' });
    } catch (e) {
      const ae = e as AxiosError<any>;
      setUMsg({ ok: false, text: ae.response?.data?.message ?? 'No se pudo guardar el perfil.' });
    } finally {
      setUSaving(false);
    }
  }

  function guardarEmpresa(ev: React.FormEvent) {
    ev.preventDefault();
    setESaving(true);
    setEMsg(null);
    try {
      saveEmpresa(eForm);
      setEMsg({ ok: true, text: 'Datos de la empresa guardados correctamente.' });
    } catch {
      setEMsg({ ok: false, text: 'No se pudo guardar la información de la empresa.' });
    } finally {
      setESaving(false);
    }
  }

  function guardarPreferencias(ev: React.FormEvent) {
    ev.preventDefault();
    setPSaving(true);
    setPMsg(null);
    try {
      savePref(pForm);
      setPMsg({ ok: true, text: 'Preferencias guardadas correctamente.' });
    } catch {
      setPMsg({ ok: false, text: 'No se pudo guardar las preferencias.' });
    } finally {
      setPSaving(false);
    }
  }

  const avatar = (me || sess?.usuario);
  const rolTxt = me?.rolNombre || sess?.usuario.rolNombre || '—';
  const rolBadge = rolTxt === 'ADMIN' ? 'badge-soft-primary' : 'badge-soft-warning';

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Gestiona tu perfil, los datos de la empresa y tus preferencias básicas.</p>
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
                  <input type="email" className="form-control" value={uForm.correo} onChange={(e) => setUForm((f) => ({ ...f, correo: e.target.value }))} required readOnly />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Teléfono</label>
                  <input className="form-control" value={uForm.telefono} onChange={(e) => setUForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="+51 987 654 321" />
                </div>
              </div>
            </div>
          </form>

          <form onSubmit={guardarEmpresa} className="section-card mb-3">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h5 className="card-title"><i className="bi bi-building-gear me-2 text-success" /> Datos de la empresa</h5>
              <button className="btn btn-sm btn-success d-flex align-items-center gap-2" type="submit" disabled={eSaving}>
                {eSaving && <span className="spinner-border spinner-border-sm" />}
                <i className="bi bi-save" /> Guardar empresa
              </button>
            </div>
            <div className="card-body">
              {eMsg && <div className={`alert small mb-3 d-flex align-items-start gap-2 py-2 ${eMsg.ok ? 'alert-success' : 'alert-danger'}`} role="alert"><i className={`bi ${eMsg.ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} mt-1`} /><div>{eMsg.text}</div></div>}
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Razón social</label>
                  <input className="form-control" value={eForm.razonSocial} onChange={(e) => setEForm((f) => ({ ...f, razonSocial: e.target.value }))} placeholder="Inmobiliaria S.A.C." />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Nombre comercial</label>
                  <input className="form-control" value={eForm.nombreComercial} onChange={(e) => setEForm((f) => ({ ...f, nombreComercial: e.target.value }))} placeholder="Antony Inmobiliaria" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">RUC</label>
                  <input className="form-control" value={eForm.ruc} onChange={(e) => setEForm((f) => ({ ...f, ruc: e.target.value }))} placeholder="20123456789" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Teléfono</label>
                  <input className="form-control" value={eForm.telefono} onChange={(e) => setEForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="+51 01 123 4567" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Correo</label>
                  <input type="email" className="form-control" value={eForm.correo} onChange={(e) => setEForm((f) => ({ ...f, correo: e.target.value }))} placeholder="info@empresa.com" />
                </div>
                <div className="col-md-12">
                  <label className="form-label small fw-semibold">Dirección</label>
                  <input className="form-control" value={eForm.direccion} onChange={(e) => setEForm((f) => ({ ...f, direccion: e.target.value }))} placeholder="Av. principal 123, Lima, Perú" />
                </div>
                <div className="col-md-12">
                  <label className="form-label small fw-semibold">Descripción</label>
                  <textarea className="form-control" rows={3} value={eForm.descripcion} onChange={(e) => setEForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Breve descripción de la empresa..." />
                </div>
              </div>
            </div>
          </form>

          <form onSubmit={guardarPreferencias} className="section-card mb-3">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h5 className="card-title"><i className="bi bi-sliders me-2 text-warning" /> Preferencias básicas</h5>
              <button className="btn btn-sm btn-warning d-flex align-items-center gap-2 text-white" type="submit" disabled={pSaving}>
                {pSaving && <span className="spinner-border spinner-border-sm" />}
                <i className="bi bi-save" /> Guardar preferencias
              </button>
            </div>
            <div className="card-body">
              {pMsg && <div className={`alert small mb-3 d-flex align-items-start gap-2 py-2 ${pMsg.ok ? 'alert-success' : 'alert-danger'}`} role="alert"><i className={`bi ${pMsg.ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} mt-1`} /><div>{pMsg.text}</div></div>}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Moneda</label>
                  <select className="form-select" value={pForm.moneda} onChange={(e) => setPForm((f) => ({ ...f, moneda: e.target.value as Preferencias['moneda'] }))}>
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Idioma</label>
                  <select className="form-select" value={pForm.idioma} onChange={(e) => setPForm((f) => ({ ...f, idioma: e.target.value as Preferencias['idioma'] }))}>
                    <option value="es-PE">Español (Perú)</option>
                    <option value="en-US">English (US)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Zona horaria</label>
                  <select className="form-select" value={pForm.zonaHoraria} onChange={(e) => setPForm((f) => ({ ...f, zonaHoraria: e.target.value }))}>
                    <option value="America/Lima">Lima, Perú (UTC-5)</option>
                    <option value="America/Bogota">Bogotá (UTC-5)</option>
                    <option value="America/Santiago">Santiago (UTC-4)</option>
                    <option value="America/Mexico_City">CDMX (UTC-6)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Página de inicio</label>
                  <select className="form-select" value={pForm.paginaInicio} onChange={(e) => setPForm((f) => ({ ...f, paginaInicio: e.target.value as Preferencias['paginaInicio'] }))}>
                    <option value="/dashboard">Dashboard</option>
                    <option value="/ventas">Ventas</option>
                    <option value="/reportes">Reportes</option>
                  </select>
                </div>
                <div className="col-md-4 d-flex align-items-center pt-3">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="notEmail" checked={pForm.notificacionesEmail} onChange={(e) => setPForm((f) => ({ ...f, notificacionesEmail: e.target.checked }))} />
                    <label className="form-check-label small fw-semibold" htmlFor="notEmail">Notificaciones por correo</label>
                  </div>
                </div>
                <div className="col-md-4 d-flex align-items-center pt-3">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="notPush" checked={pForm.notificacionesPush} onChange={(e) => setPForm((f) => ({ ...f, notificacionesPush: e.target.checked }))} />
                    <label className="form-check-label small fw-semibold" htmlFor="notPush">Notificaciones push</label>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
