'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDate, getSession, http, initials } from '@/lib/api';

type MedioCaptacion = string;
type EstadoCliente = string;

interface ClienteLight {
  id: string;
  empresaId: string;
  nombres: string;
  apellidos: string;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  correo?: string | null;
  celular?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  distrito?: string | null;
  ciudad?: string | null;
  estado?: EstadoCliente;
  medioCaptacion?: MedioCaptacion;
  observaciones?: string | null;
  fechaRegistro?: string | null;
  createdAt?: string;
  updatedAt?: string;
  presupuestoMinimo?: string | number | null;
  presupuestoMaximo?: string | number | null;
  moneda?: string | null;
  tipoPropiedadInteres?: string | null;
  propiedadInteresDetalle?: string | null;
  motivoCompra?: string | null;
  metodoPagoPreferido?: string | null;
  bancoPreferencia?: string | null;
  preAprobacionDetalle?: string | null;
  urgenciaCompra?: string | null;
  proyectos?: ProyectoOption[] | null;
}

interface ProyectoOption {
  id: string;
  nombre: string;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface FindClientesQuery {
  page: number;
  limit: number;
  search?: string;
  estado?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

const TIPO_DOC_OPCIONES = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carnet de extranjería (CE)' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'RUC', label: 'RUC' },
  { value: 'OTRO', label: 'Otro' },
];

const MEDIO_CAPTACION_OPCIONES = [
  'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'REFERIDO', 'WEB', 'LLAMADA', 'OTRO',
];

const ESTADO_OPCIONES = [
  'NUEVO', 'CONTACTADO', 'INTERESADO', 'EN_SEGUIMIENTO', 'CALIFICADO', 'NO_INTERESADO', 'CLIENTE',
];

const TIPO_PROPIEDAD_OPCIONES = [
  'CASA', 'DEPARTAMENTO', 'TERRENO', 'LOCAL', 'OFICINA', 'OTRO',
];

const MOTIVO_COMPRA_OPCIONES = [
  'VIVIENDA_FAMILIAR', 'INVERSION_RENTA', 'INVERSION_REVENTA', 'SEGUNDA_VIVIENDA',
  'VIVIENDA_VACACIONAL', 'HERENCIA', 'TRASLADO_CIUDAD', 'OTRO',
];

const METODO_PAGO_OPCIONES = [
  'CONTADO', 'CREDITO_HIPOTECARIO', 'FINANCIAMIENTO_DIRECTO',
  'PRESTAMO_PERSONAL', 'MIXTO', 'OTRO',
];

const URGENCIA_OPCIONES = [
  'URGENTE_1_MES', 'CORTO_PLAZO_3_MESES', 'MEDIO_PLAZO_6_12_MESES',
  'LARGO_PLAZO_MAS_12', 'SIN_PRISA',
];

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

function badgeEstado(estado?: string) {
  const e = (estado || '').toUpperCase();
  if (e === 'NUEVO' || e === 'CONTACTADO' || e === 'CALIFICADO' || e === 'CLIENTE' || e === 'INTERESADO') return 'badge-soft-success';
  if (e === 'NO_INTERESADO') return 'badge-soft-secondary';
  if (e === 'EN_SEGUIMIENTO') return 'badge-soft-warning';
  return 'badge-soft-primary';
}

function labelEnum(v: string | undefined | null, arr: string[]) {
  if (!v) return '—';
  const exact = arr.find((a) => a === v);
  if (exact) return exact.replace(/_/g, ' ');
  return v.replace(/_/g, ' ');
}

const EMPTY_FORM = {
  nombres: '',
  apellidos: '',
  tipoDocumento: '',
  numeroDocumento: '',
  celular: '',
  telefono: '',
  correo: '',
  fechaNacimiento: '',
  distrito: '',
  ciudad: '',
  direccion: '',
  medioCaptacion: 'REFERIDO',
  estado: 'NUEVO',
  observaciones: '',
  presupuestoMinimo: '',
  presupuestoMaximo: '',
  moneda: 'PEN',
  estadoCivil: '',
  ocupacion: '',
  empresaDondeTrabaja: '',
  // Perfil compra (nuevos campos)
  tipoPropiedadInteres: '',
  propiedadInteresDetalle: '',
  motivoCompra: '',
  metodoPagoPreferido: '',
  bancoPreferencia: '',
  preAprobacionDetalle: '',
  urgenciaCompra: '',
  proyectoIds: [] as string[],
};

export default function ClientesPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';
  const isAdmin = sess?.usuario.rolNombre === 'ADMIN';

  const modalRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<ClienteLight | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [filters, setFilters] = useState<FindClientesQuery>({
    page: 1, limit: 10, search: '', estado: '', sortBy: 'createdAt', sortDirection: 'desc',
  });

  const [data, setData] = useState<Paginated<ClienteLight> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoOption[]>([]);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindClientesQuery) => {
    if (!empresaId) return;
    setLoading(true); setError(null);
    try {
      const params: any = { page: q.page, limit: q.limit, sortBy: q.sortBy, sortDirection: q.sortDirection };
      if (q.search) params.search = q.search;
      if (q.estado) params.estado = q.estado;
      const { data: res } = await http.get<Paginated<ClienteLight>>(`/empresas/${empresaId}/clientes`, { params });
      setData(res);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.estado, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    if (!empresaId) return;
    let activo = true;
    http
      .get<ProyectoOption[]>(`/empresas/${empresaId}/proyectos`)
      .then(({ data: res }) => {
        if (activo) setProyectos(res);
      })
      .catch(() => {
        if (activo) setProyectos([]);
      });
    return () => {
      activo = false;
    };
  }, [empresaId]);

  useEffect(() => {
    if (!searchRef.current) return;
    const el = searchRef.current;
    const h = () => {
      if (debRef.current) window.clearTimeout(debRef.current);
      debRef.current = window.setTimeout(() => {
        const q = { ...filters, page: 1, search: el.value };
        setFilters(q);
        fetchPage(q);
      }, 350);
    };
    el.addEventListener('input', h);
    return () => el.removeEventListener('input', h);
  }, [fetchPage, filters]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const pages = useMemo(() => buildPages(filters.page, data?.meta.totalPages ?? 1), [filters.page, data?.meta.totalPages]);

  function openCreate() {
    setMode('create');
    setEditing(null);
    setForm({ ...EMPTY_FORM, proyectoIds: [] });
    setFormErr(null);
    queueMicrotask(() => {
      if (modalRef.current && (window as any).bootstrap) {
        (window as any).bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
      }
    });
  }

  function openEdit(c: ClienteLight) {
    setMode('edit');
    setEditing(c);
    setForm({
      nombres: c.nombres || '',
      apellidos: c.apellidos || '',
      tipoDocumento: c.tipoDocumento || '',
      numeroDocumento: c.numeroDocumento || '',
      celular: c.celular || '',
      telefono: c.telefono || '',
      correo: c.correo || '',
      fechaNacimiento: '',
      distrito: c.distrito || '',
      ciudad: c.ciudad || '',
      direccion: c.direccion || '',
      medioCaptacion: c.medioCaptacion || 'REFERIDO',
      estado: c.estado || 'NUEVO',
      observaciones: c.observaciones || '',
      presupuestoMinimo: c.presupuestoMinimo == null ? '' : String(c.presupuestoMinimo),
      presupuestoMaximo: c.presupuestoMaximo == null ? '' : String(c.presupuestoMaximo),
      moneda: c.moneda || 'PEN',
      estadoCivil: '',
      ocupacion: '',
      empresaDondeTrabaja: '',
      tipoPropiedadInteres: c.tipoPropiedadInteres || '',
      propiedadInteresDetalle: c.propiedadInteresDetalle || '',
      motivoCompra: c.motivoCompra || '',
      metodoPagoPreferido: c.metodoPagoPreferido || '',
      bancoPreferencia: c.bancoPreferencia || '',
      preAprobacionDetalle: c.preAprobacionDetalle || '',
      urgenciaCompra: c.urgenciaCompra || '',
      proyectoIds: (c.proyectos ?? []).map((p) => p.id),
    });
    setFormErr(null);
    queueMicrotask(() => {
      if (modalRef.current && (window as any).bootstrap) {
        (window as any).bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
      }
    });
  }

  function closeModal() {
    try {
      if (modalRef.current && (window as any).bootstrap) {
        const inst = (window as any).bootstrap.Modal.getInstance(modalRef.current);
        if (inst) inst.hide();
      }
    } catch { /* ignore */ }
    setEditing(null);
    setMode('create');
    setForm({ ...EMPTY_FORM, proyectoIds: [] });
    setFormErr(null);
  }

  function toggleProyecto(id: string) {
    setForm((f) => ({
      ...f,
      proyectoIds: f.proyectoIds.includes(id)
        ? f.proyectoIds.filter((x) => x !== id)
        : [...f.proyectoIds, id],
    }));
  }

  function validateForm() {
    if (!form.nombres.trim()) return 'Ingresa los nombres del cliente.';
    if (!form.apellidos.trim()) return 'Ingresa los apellidos del cliente.';
    if (!form.celular.trim()) return 'Ingresa el número de celular.';
    if (!form.medioCaptacion) return 'Selecciona el medio de captación.';
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) return 'Correo no válido.';
    if (form.proyectoIds.length === 0) return 'Selecciona al menos un proyecto de interés.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errMsg = validateForm();
    if (errMsg) { setFormErr(errMsg); return; }
    setSaving(true); setFormErr(null);
    try {
      const payload: any = {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        tipoDocumento: form.tipoDocumento || undefined,
        numeroDocumento: form.numeroDocumento || undefined,
        celular: form.celular.trim(),
        telefono: form.telefono || null,
        correo: form.correo || undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        distrito: form.distrito || undefined,
        ciudad: form.ciudad || undefined,
        direccion: form.direccion || undefined,
        medioCaptacion: form.medioCaptacion,
        estado: form.estado || undefined,
        observaciones: form.observaciones || undefined,
        presupuestoMinimo: form.presupuestoMinimo ? Number(form.presupuestoMinimo) : undefined,
        presupuestoMaximo: form.presupuestoMaximo ? Number(form.presupuestoMaximo) : undefined,
        moneda: form.moneda || undefined,
        estadoCivil: form.estadoCivil || undefined,
        ocupacion: form.ocupacion || undefined,
        empresaDondeTrabaja: form.empresaDondeTrabaja || undefined,
        tipoPropiedadInteres: form.tipoPropiedadInteres || undefined,
        propiedadInteresDetalle: form.propiedadInteresDetalle || undefined,
        motivoCompra: form.motivoCompra || undefined,
        metodoPagoPreferido: form.metodoPagoPreferido || undefined,
        bancoPreferencia: form.bancoPreferencia || undefined,
        preAprobacionDetalle: form.preAprobacionDetalle || undefined,
        urgenciaCompra: form.urgenciaCompra || undefined,
        proyectoIds: form.proyectoIds,
      };
      if (mode === 'create') {
        await http.post(`/empresas/${empresaId}/clientes`, payload);
        setToast({ ok: true, msg: 'Cliente registrado correctamente.' });
      } else if (editing) {
        await http.patch(`/empresas/${empresaId}/clientes/${editing.id}`, payload);
        setToast({ ok: true, msg: 'Cliente actualizado correctamente.' });
      }
      closeModal();
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setFormErr(err.response?.data?.message ?? 'No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ClienteLight) {
    if (!confirm(`¿Eliminar el cliente ${c.nombres} ${c.apellidos}? (se elimina lógicamente)`)) return;
    try {
      await http.delete(`/empresas/${empresaId}/clientes/${c.id}`);
      setToast({ ok: true, msg: 'Cliente eliminado correctamente.' });
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      alert(err.response?.data?.message ?? 'No se pudo eliminar el cliente.');
    }
  }

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Gestiona el portafolio de clientes, datos de contacto y seguimiento comercial.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
          onClick={openCreate}
        >
          <i className="bi bi-person-plus-fill" /> Nuevo cliente
        </button>
      </div>

      {error && <div className="alert alert-danger small mb-3 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-3">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5></div>
        <div className="card-body pb-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small fw-semibold mb-1">Buscar</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Nombres, documento, correo, teléfono..." />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Estado</label>
              <select className="form-select form-select-sm" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: e.target.value }))}>
                <option value="">Todos los estados</option>
                {ESTADO_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, ESTADO_OPCIONES)}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Ordenar</label>
              <select className="form-select form-select-sm" value={`${filters.sortBy}:${filters.sortDirection}`} onChange={(e) => {
                const [sb, sd] = e.target.value.split(':');
                setFilters((f) => ({ ...f, sortBy: sb, sortDirection: sd as 'asc' | 'desc' }));
              }}>
                <option value="createdAt:desc">Más recientes</option>
                <option value="createdAt:asc">Más antiguos</option>
                <option value="apellidos:asc">A-Z (apellidos)</option>
                <option value="apellidos:desc">Z-A (apellidos)</option>
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
          <h5 className="card-title"><i className="bi bi-people me-2 text-primary" /> Listado de clientes</h5>
          <div className="text-muted small" style={{ fontSize: '.8rem' }}>{data?.meta.total ?? 0} registros</div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle small">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Contacto</th>
                <th>Ciudad</th>
                <th>Medio captación</th>
                <th>Registro</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-4 text-muted"><div className="spinner-border spinner-border-sm me-2" /> Cargando clientes...</td></tr>
              )}
              {!loading && (!data || data.data.length === 0) && (
                <tr><td colSpan={8} className="text-center py-4 text-muted small">Sin clientes para los filtros seleccionados. Crea uno con el botón <b>Nuevo cliente</b>.</td></tr>
              )}
              {!loading && data?.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar avatar-sm rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-semibold" style={{ width: 32, height: 32, fontSize: '.78rem', background: '#1f3c88' }}>
                        {initials(c.nombres, c.apellidos)}
                      </div>
                      <div className="min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fw-semibold text-truncate">{c.nombres} {c.apellidos}</span>
                          <span className="badge badge-soft-secondary fw-semibold" style={{ fontFamily: 'monospace', fontSize: '.65rem' }} title="ID del cliente (cópialo para Pipeline)">
                            <i className="bi bi-upc me-1" />{c.id.slice(0, 12)}…
                          </span>
                        </div>
                        {c.correo && <div className="text-muted small text-truncate" style={{ fontSize: '.72rem' }}>{c.correo}</div>}
                        <div className="d-flex flex-wrap gap-1 mt-1" style={{ maxWidth: 360 }}>
                          {(() => {
                            const chips: { label: string; cls: string; icon?: string }[] = [];
                            (c.proyectos ?? []).forEach((p) => {
                              chips.push({ label: `📁 ${p.nombre}`, cls: 'badge-soft-info' });
                            });
                            const min = c.presupuestoMinimo;
                            const max = c.presupuestoMaximo;
                            if (min != null || max != null) {
                              const minStr = min != null ? Number(min).toLocaleString('es-PE', { maximumFractionDigits: 0 }) : '0';
                              const maxStr = max != null ? Number(max).toLocaleString('es-PE', { maximumFractionDigits: 0 }) : '∞';
                              chips.push({ label: `💰 S/ ${minStr} - ${maxStr}`, cls: 'badge-soft-primary' });
                            }
                            if (c.tipoPropiedadInteres) chips.push({ label: `🏠 ${labelEnum(c.tipoPropiedadInteres, TIPO_PROPIEDAD_OPCIONES)}`, cls: 'badge-soft-info' });
                            if (c.urgenciaCompra) {
                              const u = c.urgenciaCompra;
                              const uCls = u.startsWith('URGENTE') ? 'bg-danger text-white' : u.startsWith('CORTO') ? 'badge-soft-danger' : u.startsWith('MEDIO') ? 'badge-soft-warning' : u.startsWith('LARGO') ? 'badge-soft-secondary' : 'badge-soft-light';
                              chips.push({ label: `⏱ ${labelEnum(c.urgenciaCompra, URGENCIA_OPCIONES)}`, cls: uCls });
                            }
                            if (c.motivoCompra) chips.push({ label: `🎯 ${labelEnum(c.motivoCompra, MOTIVO_COMPRA_OPCIONES)}`, cls: 'badge-soft-success' });
                            if (c.metodoPagoPreferido) chips.push({ label: `💳 ${labelEnum(c.metodoPagoPreferido, METODO_PAGO_OPCIONES)}`, cls: 'badge-soft-purple' });
                            if (c.bancoPreferencia) chips.push({ label: `🏦 ${c.bancoPreferencia}`, cls: 'badge-soft-secondary' });
                            if (c.propiedadInteresDetalle) chips.push({ label: `📝 ${String(c.propiedadInteresDetalle).length > 32 ? String(c.propiedadInteresDetalle).slice(0,32)+'…' : c.propiedadInteresDetalle}`, cls: 'badge-soft-light' });
                            return chips.map((ch, i) => <span key={i} className={`badge ${ch.cls} fw-semibold`} style={{ fontSize: '.62rem' }} title={ch.label}>{ch.label}</span>);
                          })()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="small" style={{ fontFamily: 'monospace' }}>
                    {c.numeroDocumento ? (
                      <div>
                        <div className="text-muted" style={{ fontSize: '.65rem' }}>{c.tipoDocumento || '—'}</div>
                        <div>{c.numeroDocumento}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="small">
                    <div className="d-flex flex-column">
                      {c.celular && <span className="d-inline-flex align-items-center gap-1"><i className="bi bi-whatsapp text-success" /> {c.celular}</span>}
                      {c.telefono && <span className="d-inline-flex align-items-center gap-1 text-muted"><i className="bi bi-telephone" /> {c.telefono}</span>}
                      {!c.celular && !c.telefono && '—'}
                    </div>
                  </td>
                  <td className="small">{c.ciudad || c.distrito || '—'}</td>
                  <td><span className="badge badge-soft-warning fw-semibold" style={{ fontSize: '.65rem' }}>{labelEnum(c.medioCaptacion, MEDIO_CAPTACION_OPCIONES)}</span></td>
                  <td className="small">{formatDate(c.fechaRegistro || c.createdAt)}</td>
                  <td><span className={`badge ${badgeEstado(c.estado)} fw-semibold`} style={{ fontSize: '.65rem' }}>{labelEnum(c.estado, ESTADO_OPCIONES)}</span></td>
                  <td>
                    <div className="d-flex justify-content-end gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title="Copiar ID del cliente (para Pipeline/Visita/Reserva)"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(c.id);
                            setToast({ ok: true, msg: `✅ ID copiado: ${c.id.slice(0, 12)}…` });
                          } catch {
                            setToast({ ok: false, msg: 'No se pudo copiar. Copia manual: ' + c.id });
                          }
                        }}
                      >
                        <i className="bi bi-clipboard" />
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-primary" title="Editar cliente" onClick={() => openEdit(c)}><i className="bi bi-pencil-square" /></button>
                      <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar lógicamente" onClick={() => handleDelete(c)}><i className="bi bi-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.meta.totalPages > 1 && (
          <div className="card-footer border-0 d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2">
            <div className="text-muted small" style={{ fontSize: '.78rem' }}>Página {filters.page} de {data.meta.totalPages}</div>
            <nav aria-label="Paginación clientes">
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

      {/* Modal crear/editar cliente */}
      <div id="clientesFormModal" className="modal fade" ref={modalRef} tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form onSubmit={onSubmit} noValidate>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className={`bi ${mode === 'create' ? 'bi-person-plus-fill' : 'bi-pencil-square'} me-2 text-primary`} />{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={closeModal} />
              </div>
              <div className="modal-body">
                {formErr && <div className="alert alert-danger small py-2 mb-3 d-flex align-items-start gap-2" role="alert"><i className="bi bi-exclamation-circle mt-1" /><div>{formErr}</div></div>}
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Nombres *</label>
                    <input className="form-control" value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} required maxLength={100} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Apellidos *</label>
                    <input className="form-control" value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} required maxLength={100} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Tipo documento</label>
                    <select className="form-select" value={form.tipoDocumento} onChange={(e) => setForm((f) => ({ ...f, tipoDocumento: e.target.value }))}>
                      <option value="">— Sin documento —</option>
                      {TIPO_DOC_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">N° documento</label>
                    <input className="form-control" value={form.numeroDocumento} onChange={(e) => setForm((f) => ({ ...f, numeroDocumento: e.target.value }))} maxLength={30} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Celular *</label>
                    <input className="form-control" value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} required maxLength={30} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Teléfono</label>
                    <input className="form-control" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} maxLength={30} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Correo</label>
                    <input type="email" className="form-control" value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} maxLength={120} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Fecha nacimiento</label>
                    <input type="date" className="form-control" value={form.fechaNacimiento} onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Distrito</label>
                    <input className="form-control" value={form.distrito} onChange={(e) => setForm((f) => ({ ...f, distrito: e.target.value }))} maxLength={100} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Ciudad</label>
                    <input className="form-control" value={form.ciudad} onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))} maxLength={100} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Dirección</label>
                    <input className="form-control" value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} maxLength={255} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Medio captación *</label>
                    <select className="form-select" required value={form.medioCaptacion} onChange={(e) => setForm((f) => ({ ...f, medioCaptacion: e.target.value }))}>
                      {MEDIO_CAPTACION_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, MEDIO_CAPTACION_OPCIONES)}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Estado</label>
                    <select className="form-select" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                      {ESTADO_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, ESTADO_OPCIONES)}</option>)}
                    </select>
                  </div>

                  {/* ===== Perfil de compra (nuevos campos) ===== */}
                  <div className="col-12 mt-2">
                    <div className="d-flex align-items-center gap-2 small py-1 px-2 rounded-1 fw-semibold text-primary" style={{ background: '#eef2ff' }}>
                      <i className="bi bi-funnel-fill" />
                      <span>Perfil de compra y preferencias</span>
                      <small className="text-muted ms-auto">Recomendado para seguimiento comercial</small>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">
                      Proyectos de interés <span className="text-danger">*</span>
                    </label>
                    {proyectos.length === 0 ? (
                      <div className="alert alert-warning small py-2 mb-0">
                        No hay proyectos registrados en esta empresa. Registra un proyecto antes de crear clientes.
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-2 p-2" style={{ maxHeight: 140, overflowY: 'auto' }}>
                          {proyectos.map((p) => (
                            <div className="form-check" key={p.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`cliente-proyecto-${p.id}`}
                                checked={form.proyectoIds.includes(p.id)}
                                onChange={() => toggleProyecto(p.id)}
                              />
                              <label className="form-check-label small" htmlFor={`cliente-proyecto-${p.id}`}>
                                {p.nombre}
                              </label>
                            </div>
                          ))}
                        </div>
                        <small className={form.proyectoIds.length === 0 ? 'text-danger' : 'text-muted'}>
                          {form.proyectoIds.length === 0
                            ? 'Selecciona al menos un proyecto.'
                            : `${form.proyectoIds.length} proyecto(s) seleccionado(s).`}
                        </small>
                      </>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">1. Tipo propiedad de interés</label>
                    <select className="form-select" value={form.tipoPropiedadInteres} onChange={(e) => setForm((f) => ({ ...f, tipoPropiedadInteres: e.target.value }))}>
                      <option value="">— No definido —</option>
                      {TIPO_PROPIEDAD_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, TIPO_PROPIEDAD_OPCIONES)}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Presupuesto mínimo (S/)</label>
                    <input type="number" className="form-control" min={0} step={0.01} value={form.presupuestoMinimo} onChange={(e) => setForm((f) => ({ ...f, presupuestoMinimo: e.target.value }))} placeholder="Ej. 150000" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Presupuesto máximo / Rango (S/)</label>
                    <input type="number" className="form-control" min={0} step={0.01} value={form.presupuestoMaximo} onChange={(e) => setForm((f) => ({ ...f, presupuestoMaximo: e.target.value }))} placeholder="Ej. 250000" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">8. Nivel de urgencia</label>
                    <select className="form-select" value={form.urgenciaCompra} onChange={(e) => setForm((f) => ({ ...f, urgenciaCompra: e.target.value }))}>
                      <option value="">— No definido —</option>
                      {URGENCIA_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, URGENCIA_OPCIONES)}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">3. Propiedad de interés (detalle)</label>
                    <input className="form-control" value={form.propiedadInteresDetalle} onChange={(e) => setForm((f) => ({ ...f, propiedadInteresDetalle: e.target.value }))} maxLength={255} placeholder="Ej. Dpto 3D, piso alto, vista al mar" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">4. Motivo de compra</label>
                    <select className="form-select" value={form.motivoCompra} onChange={(e) => setForm((f) => ({ ...f, motivoCompra: e.target.value }))}>
                      <option value="">— No definido —</option>
                      {MOTIVO_COMPRA_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, MOTIVO_COMPRA_OPCIONES)}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">5. Método de pago preferido</label>
                    <select className="form-select" value={form.metodoPagoPreferido} onChange={(e) => setForm((f) => ({ ...f, metodoPagoPreferido: e.target.value }))}>
                      <option value="">— No definido —</option>
                      {METODO_PAGO_OPCIONES.map((o) => <option key={o} value={o}>{labelEnum(o, METODO_PAGO_OPCIONES)}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Moneda presupuesto</label>
                    <select className="form-select" value={form.moneda || ''} onChange={(e) => setForm((f) => ({ ...f, moneda: e.target.value }))}>
                      <option value="PEN">Soles (PEN)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">6. Banco preferencia</label>
                    <input className="form-control" value={form.bancoPreferencia} onChange={(e) => setForm((f) => ({ ...f, bancoPreferencia: e.target.value }))} maxLength={150} placeholder="Ej. BCP / Interbank / BBVA / Scotiabank" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">7. Pre-aprobación (detalle / monto / vence)</label>
                    <input className="form-control" value={form.preAprobacionDetalle} onChange={(e) => setForm((f) => ({ ...f, preAprobacionDetalle: e.target.value }))} maxLength={255} placeholder="Ej. Carta BCP N°1234, USD 200k, vence 31/12" />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Observaciones</label>
                    <textarea className="form-control" rows={2} value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2" disabled={saving}>
                  {saving && <div className="spinner-border spinner-border-sm" aria-hidden="true" />}
                  <i className={`bi ${mode === 'create' ? 'bi-save' : 'bi-pencil'}`} />
                  {mode === 'create' ? 'Guardar cliente' : 'Actualizar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Toast global */}
      {toast && (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
          <div className={`toast align-items-center text-white ${toast.ok ? 'bg-success' : 'bg-danger'} border-0 show`} role="alert" aria-live="assertive">
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} aria-label="Cerrar" />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
