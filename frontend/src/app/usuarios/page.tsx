'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDate, getSession, http, initials } from '@/lib/api';

type RolNombre = 'ADMIN' | 'ASESOR';

interface RolLight {
  id: string;
  nombre: RolNombre;
  descripcion?: string | null;
}

interface UsuarioLight {
  id: string;
  empresaId: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  avatar?: string | null;
  active: boolean;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  rolId: string;
  rol: RolLight;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface FindUsuariosQuery {
  page: number;
  limit: number;
  search?: string;
  rolNombre?: '' | RolNombre;
  active?: '' | 'true' | 'false';
}

interface CreateUsuarioInput {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  rolNombre: RolNombre;
  password: string;
  active: boolean;
}

interface UpdateUsuarioInput {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  rolNombre: RolNombre;
  active: boolean;
}

function buildPages(c: number, t: number): (number | '...')[] {
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  const l = Math.max(2, c - 1), r = Math.min(t - 1, c + 1);
  if (l > 2) pages.push('...');
  for (let i = l; i <= r; i++) pages.push(i);
  if (r < t - 1) pages.push('...');
  pages.push(t);
  return pages;
}

function rolBadge(rol: RolNombre) {
  if (rol === 'ADMIN') return { cls: 'badge-soft-primary', label: 'Administrador' };
  return { cls: 'badge-soft-success', label: 'Asesor' };
}

function emptyCreate(): CreateUsuarioInput {
  return {
    nombres: '',
    apellidos: '',
    correo: '',
    telefono: '',
    rolNombre: 'ASESOR',
    password: '',
    active: true,
  };
}

export default function UsuariosPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindUsuariosQuery>({
    page: 1,
    limit: 10,
    search: '',
    rolNombre: '',
    active: '',
  });
  const [data, setData] = useState<Paginated<UsuarioLight> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Modal crear/editar
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<UsuarioLight | null>(null);
  const [form, setForm] = useState<CreateUsuarioInput>(emptyCreate());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalSaving, setModalSaving] = useState(false);
  const [modalGlobalErr, setModalGlobalErr] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Modal restablecer contraseña
  const [pwdTarget, setPwdTarget] = useState<UsuarioLight | null>(null);
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const pwdModalRef = useRef<HTMLDivElement | null>(null);

  function getBs() {
    if (typeof window === 'undefined') return null;
    return (window as any).bootstrap || null;
  }
  function getModal(ref: React.MutableRefObject<HTMLDivElement | null>) {
    const B = getBs();
    if (!B?.Modal || !ref.current) return null;
    return B.Modal.getOrCreateInstance(ref.current, { backdrop: 'static', keyboard: false });
  }
  function showModal(ref: React.MutableRefObject<HTMLDivElement | null>) {
    let cancelled = false;
    let tries = 0;
    const t = () => {
      if (cancelled) return;
      const m = getModal(ref);
      if (m) { m.show(); return; }
      if (tries++ < 150) { window.setTimeout(t, 30); return; }
    };
    t();
    return () => { cancelled = true; };
  }
  function hideModal(ref: React.MutableRefObject<HTMLDivElement | null>) {
    const m = getModal(ref);
    if (m) m.hide();
  }

  const fetchPage = useCallback(async (q: FindUsuariosQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: q.page, limit: q.limit };
      if (q.search) params.search = q.search;
      if (q.rolNombre) params.rolNombre = q.rolNombre;
      if (q.active) params.active = q.active === 'true';
      const { data: res } = await http.get<Paginated<UsuarioLight>>(`/empresas/${empresaId}/usuarios`, { params });
      setData(res);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.rolNombre, filters.active]);

  useEffect(() => {
    if (!searchRef.current) return;
    const el = searchRef.current;
    const handler = () => {
      if (debRef.current) window.clearTimeout(debRef.current);
      debRef.current = window.setTimeout(() => {
        const q = { ...filters, page: 1, search: el.value };
        setFilters(q);
        fetchPage(q);
      }, 350);
    };
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [fetchPage, filters]);

  // (sin useEffect de inicialización modal: se gestiona todo por getOrCreateInstance al abrir/cerrar)

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const pages = useMemo(() => buildPages(filters.page, data?.meta.totalPages ?? 1), [filters.page, data?.meta.totalPages]);

  function openCreate() {
    setMode('create');
    setEditing(null);
    setFormErrors({});
    setModalGlobalErr(null);
    setForm(emptyCreate());
    showModal(modalRef);
  }
  function openEdit(u: UsuarioLight) {
    setMode('edit');
    setEditing(u);
    setFormErrors({});
    setModalGlobalErr(null);
    setForm({
      nombres: u.nombres,
      apellidos: u.apellidos,
      correo: u.correo,
      telefono: u.telefono || '',
      rolNombre: u.rol.nombre,
      password: '',
      active: u.active,
    });
    showModal(modalRef);
  }
  function closeModal() {
    hideModal(modalRef);
    setEditing(null);
  }
  function openPwd(u: UsuarioLight) {
    setPwdTarget(u);
    setPwdNew('');
    setPwdConfirm('');
    setPwdErr(null);
    showModal(pwdModalRef);
  }
  function closePwd() {
    hideModal(pwdModalRef);
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!form.nombres.trim()) e.nombres = 'Nombres requeridos.';
    else if (form.nombres.trim().length > 100) e.nombres = 'Máximo 100 caracteres.';
    if (!form.apellidos.trim()) e.apellidos = 'Apellidos requeridos.';
    else if (form.apellidos.trim().length > 100) e.apellidos = 'Máximo 100 caracteres.';
    if (!form.correo.trim()) e.correo = 'Correo requerido.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) e.correo = 'Correo inválido.';
    if (form.telefono && form.telefono.length > 30) e.telefono = 'Máximo 30 caracteres.';
    if (!form.rolNombre) e.rolNombre = 'Selecciona un rol.';
    if (mode === 'create') {
      if (!form.password) e.password = 'Contraseña requerida.';
      else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres.';
      else if (!/[A-Z]/.test(form.password)) e.password = 'Requiere al menos una mayúscula.';
      else if (!/[a-z]/.test(form.password)) e.password = 'Requiere al menos una minúscula.';
      else if (!/\d/.test(form.password)) e.password = 'Requiere al menos un número.';
      else if (!/[^A-Za-z0-9]/.test(form.password)) e.password = 'Requiere al menos un símbolo.';
    }
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setModalGlobalErr(null);
    if (!sess) return;
    if (!validateForm()) return;
    setModalSaving(true);
    try {
      if (mode === 'create') {
        const tel = form.telefono.trim();
        const payload: any = {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          correo: form.correo.trim().toLowerCase(),
          rolNombre: form.rolNombre,
          password: form.password,
          active: form.active,
        };
        if (tel) payload.telefono = tel;
        await http.post(`/empresas/${sess.usuario.empresaId}/usuarios`, payload);
        setToast('Usuario creado correctamente.');
      } else if (mode === 'edit' && editing) {
        const tel = form.telefono.trim();
        const payload: any = {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          correo: form.correo.trim().toLowerCase(),
          rolNombre: form.rolNombre,
          active: form.active,
        };
        if (tel) payload.telefono = tel;
        else payload.telefono = null;
        await http.patch(`/empresas/${sess.usuario.empresaId}/usuarios/${editing.id}`, payload);
        setToast('Usuario actualizado correctamente.');
      }
      closeModal();
      fetchPage(filters);
    } catch (err) {
      const e = err as AxiosError<any>;
      const msg = e.response?.data?.message;
      setModalGlobalErr(Array.isArray(msg) ? msg[0] : msg || 'No se pudo guardar el usuario.');
    } finally {
      setModalSaving(false);
    }
  }

  async function handleToggleActive(u: UsuarioLight) {
    if (!sess) return;
    try {
      await http.patch(`/empresas/${sess.usuario.empresaId}/usuarios/${u.id}/activar`);
      setToast(u.active ? 'Usuario desactivado correctamente.' : 'Usuario activado correctamente.');
      fetchPage(filters);
    } catch (err) {
      const e = err as AxiosError<any>;
      setError(e.response?.data?.message || 'No se pudo cambiar el estado del usuario.');
    }
  }

  async function handleDelete(u: UsuarioLight) {
    if (!sess) return;
    const ok = window.confirm(`¿Eliminar lógicamente al usuario "${u.nombres} ${u.apellidos}"? Esta acción se puede deshacer activándolo nuevamente.`);
    if (!ok) return;
    try {
      await http.delete(`/empresas/${sess.usuario.empresaId}/usuarios/${u.id}`);
      setToast('Usuario eliminado lógicamente correctamente.');
      fetchPage(filters);
    } catch (err) {
      const e = err as AxiosError<any>;
      setError(e.response?.data?.message || 'No se pudo eliminar el usuario.');
    }
  }

  async function handlePwdSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setPwdErr(null);
    if (!sess || !pwdTarget) return;
    if (!pwdNew) { setPwdErr('Nueva contraseña requerida.'); return; }
    if (pwdNew.length < 8 || !/[A-Z]/.test(pwdNew) || !/[a-z]/.test(pwdNew) || !/\d/.test(pwdNew) || !/[^A-Za-z0-9]/.test(pwdNew)) {
      setPwdErr('Debe tener ≥8 caracteres, mayúscula, minúscula, número y símbolo.');
      return;
    }
    if (pwdNew !== pwdConfirm) { setPwdErr('Las contraseñas no coinciden.'); return; }
    setPwdSaving(true);
    try {
      await http.patch(`/empresas/${sess.usuario.empresaId}/usuarios/${pwdTarget.id}/password`, { password: pwdNew });
      setToast('Contraseña restablecida correctamente.');
      closePwd();
    } catch (err) {
      const e = err as AxiosError<any>;
      setPwdErr(e.response?.data?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <AppLayout>
      {toast && (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1090 }}>
          <div className="toast show align-items-center text-bg-success border-0" role="alert">
            <div className="d-flex">
              <div className="toast-body small"><i className="bi bi-check-circle-fill me-2" />{toast}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} aria-label="Cerrar" />
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">Gestiona las cuentas de acceso (asesores y administradores) que tienen permiso para ingresar al CRM.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
          data-bs-toggle="modal"
          data-bs-target="#usuariosFormModal"
          onClick={openCreate}
        >
          <i className="bi bi-person-plus-fill" /> Nuevo usuario
        </button>
      </div>

      {error && <div className="alert alert-danger small mb-3 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-3">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5></div>
        <div className="card-body pb-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label small fw-semibold mb-1">Buscar</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Nombres, apellidos, correo, teléfono..." />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Rol</label>
              <select className="form-select form-select-sm" value={filters.rolNombre} onChange={(e) => setFilters((f) => ({ ...f, page: 1, rolNombre: e.target.value as any }))}>
                <option value="">Todos los roles</option>
                <option value="ADMIN">Administrador</option>
                <option value="ASESOR">Asesor</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">Estado</label>
              <select className="form-select form-select-sm" value={filters.active} onChange={(e) => setFilters((f) => ({ ...f, page: 1, active: e.target.value as any }))}>
                <option value="">Activos e inactivos</option>
                <option value="true">Solo activos</option>
                <option value="false">Solo inactivos</option>
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}>
                <option value={10}>10 / pág.</option>
                <option value={20}>20 / pág.</option>
                <option value={50}>50 / pág.</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h5 className="card-title"><i className="bi bi-person-badge me-2 text-primary" /> Listado de usuarios</h5>
          <div className="text-muted small" style={{ fontSize: '.8rem' }}>{data?.meta.total ?? 0} registros</div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle small">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Teléfono</th>
                <th>Último login</th>
                <th>Creado</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-4 text-muted"><div className="spinner-border spinner-border-sm me-2" /> Cargando usuarios...</td></tr>
              )}
              {!loading && (!data || data.data.length === 0) && (
                <tr><td colSpan={7} className="text-center py-4 text-muted small">Sin usuarios para los filtros seleccionados.</td></tr>
              )}
              {!loading && data?.data.map((u) => {
                const badge = rolBadge(u.rol.nombre);
                const color = u.rol.nombre === 'ADMIN' ? '#7c3aed' : '#1f3c88';
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar avatar-sm rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-semibold" style={{ width: 36, height: 36, fontSize: '.82rem', background: color }}>
                          {initials(u.nombres, u.apellidos)}
                        </div>
                        <div className="min-w-0">
                          <div className="fw-semibold text-truncate">{u.nombres} {u.apellidos}</div>
                          <div className="text-muted small text-truncate" style={{ fontSize: '.72rem' }}>{u.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${badge.cls} fw-semibold`} style={{ fontSize: '.7rem' }}>{badge.label}</span></td>
                    <td className="small">{u.telefono || '—'}</td>
                    <td className="small">{u.lastLogin ? formatDate(u.lastLogin) : '—'}</td>
                    <td className="small">{formatDate(u.createdAt)}</td>
                    <td>{u.active
                      ? <span className="badge badge-soft-success fw-semibold" style={{ fontSize: '.7rem' }}>Activo</span>
                      : <span className="badge badge-soft-secondary fw-semibold" style={{ fontSize: '.7rem' }}>Inactivo</span>}
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button type="button" className="btn btn-sm btn-outline-primary" title="Editar datos" data-bs-toggle="modal" data-bs-target="#usuariosFormModal" onClick={() => openEdit(u)}><i className="bi bi-pencil-square" /></button>
                        <button type="button" className={`btn btn-sm ${u.active ? 'btn-outline-warning' : 'btn-outline-success'}`} title={u.active ? 'Desactivar cuenta' : 'Activar cuenta'} onClick={() => handleToggleActive(u)}>
                          <i className={`bi ${u.active ? 'bi-power' : 'bi-person-check'}`} />
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-info" title="Restablecer contraseña" data-bs-toggle="modal" data-bs-target="#usuariosPwdModal" onClick={() => openPwd(u)}><i className="bi bi-key-fill" /></button>
                        {sess?.usuario.id !== u.id && (
                          <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar lógicamente" onClick={() => handleDelete(u)}><i className="bi bi-trash" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.meta.totalPages > 1 && (
          <div className="card-footer border-0 d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2">
            <div className="text-muted small" style={{ fontSize: '.78rem' }}>Página {filters.page} de {data.meta.totalPages}</div>
            <nav aria-label="Paginación usuarios">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${filters.page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: 1 }))} disabled={filters.page === 1}><i className="bi bi-chevron-double-left" /></button>
                </li>
                <li className={`page-item ${filters.page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} disabled={filters.page === 1}><i className="bi bi-chevron-left" /></button>
                </li>
                {pages.map((p, i) => (
                  <li key={i} className={`page-item ${p === '...' ? 'disabled' : ''} ${p === filters.page ? 'active' : ''}`}>
                    <button className="page-link" disabled={p === '...'} onClick={() => p !== '...' && setFilters((f) => ({ ...f, page: p as number }))}>{p}</button>
                  </li>
                ))}
                <li className={`page-item ${filters.page === data.meta.totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} disabled={filters.page === data.meta.totalPages}><i className="bi bi-chevron-right" /></button>
                </li>
                <li className={`page-item ${filters.page === data.meta.totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: data.meta.totalPages }))} disabled={filters.page === data.meta.totalPages}><i className="bi bi-chevron-double-right" /></button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* Modal: Crear / Editar usuario */}
      <div id="usuariosFormModal" className="modal fade" ref={modalRef} tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-header">
                <h5 className="modal-title"><i className={`bi ${mode === 'create' ? 'bi-person-plus-fill' : 'bi-pencil-square'} me-2 text-primary`} />{mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" onClick={() => setEditing(null)} />
              </div>
              <div className="modal-body">
                {modalGlobalErr && <div className="alert alert-danger small py-2 mb-3 d-flex align-items-start gap-2" role="alert"><i className="bi bi-exclamation-circle mt-1" /><div>{modalGlobalErr}</div></div>}
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Nombres <span className="text-danger">*</span></label>
                    <input className={`form-control form-control-sm ${formErrors.nombres ? 'is-invalid' : ''}`} value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} placeholder="Ej. Carlos Alberto" />
                    {formErrors.nombres && <div className="invalid-feedback small">{formErrors.nombres}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Apellidos <span className="text-danger">*</span></label>
                    <input className={`form-control form-control-sm ${formErrors.apellidos ? 'is-invalid' : ''}`} value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} placeholder="Ej. Gómez Pérez" />
                    {formErrors.apellidos && <div className="invalid-feedback small">{formErrors.apellidos}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Correo <span className="text-danger">*</span></label>
                    <input type="email" className={`form-control form-control-sm ${formErrors.correo ? 'is-invalid' : ''}`} value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} placeholder="carlos@antony.com" />
                    {formErrors.correo && <div className="invalid-feedback small">{formErrors.correo}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Teléfono</label>
                    <input className={`form-control form-control-sm ${formErrors.telefono ? 'is-invalid' : ''}`} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+51 999 000 111" />
                    {formErrors.telefono && <div className="invalid-feedback small">{formErrors.telefono}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Rol <span className="text-danger">*</span></label>
                    <select className={`form-select form-select-sm ${formErrors.rolNombre ? 'is-invalid' : ''}`} value={form.rolNombre} onChange={(e) => setForm({ ...form, rolNombre: e.target.value as RolNombre })}>
                      <option value="ASESOR">Asesor</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                    {formErrors.rolNombre && <div className="invalid-feedback small">{formErrors.rolNombre}</div>}
                  </div>
                  {mode === 'create' && (
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Contraseña temporal <span className="text-danger">*</span></label>
                      <input type="password" className={`form-control form-control-sm ${formErrors.password ? 'is-invalid' : ''}`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mín. 8 caracteres, mayúscula, número y símbolo" />
                      {formErrors.password && <div className="invalid-feedback small">{formErrors.password}</div>}
                    </div>
                  )}
                  <div className="col-12 mt-1">
                    <label className="form-check small">
                      <input type="checkbox" className="form-check-input" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                      <span className="form-check-label">Usuario activo (puede iniciar sesión)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal" onClick={() => setEditing(null)} disabled={modalSaving}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2" disabled={modalSaving}>
                  {modalSaving && <div className="spinner-border spinner-border-sm" aria-hidden="true" />}
                  <i className={`bi ${mode === 'create' ? 'bi-save' : 'bi-pencil'}`} />
                  {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Restablecer contraseña */}
      <div id="usuariosPwdModal" className="modal fade" ref={pwdModalRef} tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handlePwdSubmit} noValidate>
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-key-fill me-2 text-info" />Restablecer contraseña</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" />
              </div>
              <div className="modal-body">
                {pwdTarget && <div className="small text-muted mb-3">Cambiará la contraseña de: <b className="text-dark">{pwdTarget.nombres} {pwdTarget.apellidos}</b> <span className="fw-normal">({pwdTarget.correo})</span></div>}
                {pwdErr && <div className="alert alert-danger small py-2 mb-3 d-flex align-items-start gap-2" role="alert"><i className="bi bi-exclamation-circle mt-1" /><div>{pwdErr}</div></div>}
                <div className="mb-2">
                  <label className="form-label small fw-semibold mb-1">Nueva contraseña <span className="text-danger">*</span></label>
                  <input type="password" className="form-control form-control-sm" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} placeholder="Mín. 8 caracteres, mayúscula, número y símbolo" />
                </div>
                <div className="mb-1">
                  <label className="form-label small fw-semibold mb-1">Confirmar contraseña <span className="text-danger">*</span></label>
                  <input type="password" className="form-control form-control-sm" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} placeholder="Repite la nueva contraseña" />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal" disabled={pwdSaving}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-info text-white d-inline-flex align-items-center gap-2" disabled={pwdSaving}>
                  {pwdSaving && <div className="spinner-border spinner-border-sm" aria-hidden="true" />}
                  <i className="bi bi-key-fill" /> Restablecer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
