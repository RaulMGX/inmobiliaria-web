'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ReservaModal from '@/components/ReservaModal';
import { formatDate, formatDateTime, formatPEN, getSession, http, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  ESTADOS_RESERVA,
  EstadoReserva,
  FindReservasQuery,
  Paginated,
  PropiedadLight,
  RESERVA_BADGE,
  Reserva,
} from '@/lib/visitas-reservas';

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

function isOverdue(r: Reserva): boolean {
  if (r.estado === 'CANCELADA' || r.estado === 'CONVERTIDA') return false;
  return new Date(r.fechaVencimiento).getTime() < Date.now();
}

export default function ReservasPage() {
  const router = useRouter();
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';
  const yoAsesor: AsesorLight | null = sess?.usuario
    ? {
        id: sess.usuario.id,
        nombres: sess.usuario.nombres || '',
        apellidos: sess.usuario.apellidos || '',
        correo: sess.usuario.correo || null,
      }
    : null;

  const [filters, setFilters] = useState<FindReservasQuery>({
    page: 1, limit: 10, search: '', estado: '', clienteId: '',
    propiedadId: '', asesorId: '', vencidas: '', sortBy: 'fechaVencimiento', sortDirection: 'asc',
  });

  const [data, setData] = useState<Paginated<Reserva> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [asesores, setAsesores] = useState<AsesorLight[]>(yoAsesor ? [yoAsesor] : []);
  const [propiedades, setPropiedades] = useState<PropiedadLight[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Reserva | null>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindReservasQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as (keyof FindReservasQuery)[]).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null) return;
        params[k] = v;
      });
      const { data: res } = await http.get<Paginated<Reserva>>(`/empresas/${empresaId}/reservas`, { params });
      setData(res);
      setClientes((prev) => {
        const m = new Map(prev.map((c) => [c.id, c]));
        res.data.forEach((r) => { if (r.cliente) m.set(r.cliente.id, r.cliente); });
        return Array.from(m.values());
      });
      setAsesores((prev) => {
        const m = new Map(prev.map((a) => [a.id, a]));
        res.data.forEach((r) => { if (r.asesor) m.set(r.asesor.id, r.asesor); });
        return Array.from(m.values());
      });
      setPropiedades((prev) => {
        const m = new Map(prev.map((p) => [p.id, p]));
        res.data.forEach((r) => { if (r.propiedad) m.set(r.propiedad.id, r.propiedad); });
        return Array.from(m.values());
      });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar las reservas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.estado, filters.clienteId, filters.propiedadId, filters.asesorId, filters.vencidas, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      try {
        const [resCli, resProp, resUsr] = await Promise.allSettled([
          http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }),
          http.get<any>(`/empresas/${empresaId}/propiedades`, { params: { page: 1, limit: 100 } }),
          http.get<any>(`/empresas/${empresaId}/usuarios`, { params: { page: 1, limit: 100 } }),
        ]);
        if (resCli.status === 'fulfilled') {
          const listCli = (resCli.value.data?.data ?? resCli.value.data ?? []) as any[];
          setClientes((prev) => {
            const m = new Map(prev.map((c) => [c.id, c]));
            listCli.forEach((c) => m.set(c.id, { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, estado: c.estado || 'NUEVO' } as ClienteLight));
            return Array.from(m.values());
          });
        }
        if (resProp.status === 'fulfilled') {
          const listProp = (resProp.value.data?.data ?? resProp.value.data ?? []) as any[];
          setPropiedades((prev) => {
            const m = new Map(prev.map((p) => [p.id, p]));
            listProp.forEach((p) => m.set(p.id, { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null } as PropiedadLight));
            return Array.from(m.values());
          });
        }
        setAsesores((prev) => {
          const m = new Map(prev.map((a) => [a.id, a]));
          if (yoAsesor) m.set(yoAsesor.id, yoAsesor);
          if (resUsr.status === 'fulfilled') {
            const listUsr = (resUsr.value.data?.data ?? resUsr.value.data ?? []) as any[];
            listUsr.forEach((u) => {
              if (!u?.id) return;
              m.set(u.id, { id: u.id, nombres: u.nombres || '', apellidos: u.apellidos || '', correo: u.correo || null } as AsesorLight);
            });
          }
          return Array.from(m.values());
        });
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function onSaved(r: Reserva) {
    setModalOpen(false);
    setEditTarget(null);
    if (r.cliente) setClientes((prev) => prev.find((c) => c.id === r.cliente.id) ? prev : [...prev, r.cliente]);
    if (r.asesor) setAsesores((prev) => prev.find((a) => a.id === r.asesor.id) ? prev : [...prev, r.asesor]);
    if (r.propiedad) setPropiedades((prev) => prev.find((p) => p.id === r.propiedad.id) ? prev : [...prev, r.propiedad]);
    fetchPage(filters);
  }

  function onRefAdd(kind: 'cliente' | 'asesor' | 'propiedad', ref: any) {
    if (kind === 'cliente') setClientes((prev) => prev.find((c) => c.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'asesor') setAsesores((prev) => prev.find((a) => a.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'propiedad') setPropiedades((prev) => prev.find((p) => p.id === ref.id) ? prev : [...prev, ref]);
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente esta reserva?')) return;
    try {
      await http.delete(`/empresas/${empresaId}/reservas/${id}`);
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar la reserva.');
    }
  }

  const meta = data?.meta;
  const pages = useMemo(() => buildPages(meta?.page ?? 1, meta?.totalPages ?? 1), [meta]);

  const stats = useMemo(() => {
    if (!data?.data) return { activas: 0, vencidas: 0, total: 0 };
    let activas = 0, vencidas = 0;
    data.data.forEach((r) => {
      if (r.estado === 'ACTIVA') activas++;
      if (r.estado === 'VENCIDA' || isOverdue(r)) vencidas++;
    });
    return { activas, vencidas, total: meta?.total ?? 0 };
  }, [data, meta]);

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Gestiona las reservas de separación de propiedades de tus clientes.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">
            Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0'}
          </div>
          <button className="btn btn-sm btn-success d-flex align-items-center gap-2" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}>
            <i className="bi bi-plus-lg" /> Nueva reserva
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2 small mb-4 py-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>{error}</div>
        </div>
      )}

      {toast && (
        <div className={`toast-container position-fixed top-0 end-0 p-3`} style={{ zIndex: 9999 }}>
          <div className={`toast show align-items-center text-white border-0 ${toast.ok ? 'bg-success' : 'bg-danger'}`} role="alert" onClick={() => setToast(null)}>
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" aria-label="Close" onClick={(e) => { e.stopPropagation(); setToast(null); }} />
            </div>
          </div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-receipt-cutoff fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Totales</div>
                <div className="fw-bold fs-5">{stats.total}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-check-circle-fill fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Activas</div>
                <div className="fw-bold fs-5 text-success">{stats.activas}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-exclamation-triangle-fill fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Vencidas</div>
                <div className="fw-bold fs-5 text-danger">{stats.vencidas}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-cash-stack fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Separación pág.</div>
                <div className="fw-bold fs-5">{formatPEN((data?.data ?? []).reduce((s, r) => s + parseFloat(r.montoSeparacion || '0'), 0))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small mb-4 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-4">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-funnel me-2 text-success" /> Filtros</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <label className="form-label small fw-semibold">Buscar</label>
              <div className="input-group">
                <span className="input-group-text bg-white text-muted"><i className="bi bi-search" /></span>
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Cliente, propiedad, asesor, observaciones..." />
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Estado</label>
              <select className="form-select" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoReserva) || '' }))}>
                <option value="">Todos</option>
                {ESTADOS_RESERVA.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Solo vencidas</label>
              <select className="form-select" value={filters.vencidas as any} onChange={(e) => setFilters((f) => ({ ...f, page: 1, vencidas: (e.target.value === '' ? '' : e.target.value === 'true') as any }))}>
                <option value="">Todas</option>
                <option value="true">Vencidas</option>
                <option value="false">No vencidas</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Cliente</label>
              <select className="form-select" value={filters.clienteId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, clienteId: e.target.value }))}>
                <option value="">Todos</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Asesor</label>
              <select className="form-select" value={filters.asesorId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, asesorId: e.target.value }))}>
                <option value="">Todos</option>
                {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Propiedad</label>
              <select className="form-select" value={filters.propiedadId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, propiedadId: e.target.value }))}>
                <option value="">Todas</option>
                {propiedades.map((p) => <option key={p.id} value={p.id}>[{p.codigoInterno}] {p.nombre}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Ordenar por</label>
              <select className="form-select" value={filters.sortBy} onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as any }))}>
                <option value="fechaVencimiento">Vence</option>
                <option value="fechaReserva">Reserva</option>
                <option value="montoSeparacion">Monto</option>
                <option value="estado">Estado</option>
                <option value="createdAt">Creada</option>
                <option value="updatedAt">Actualizada</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Mostrar</label>
              <select className="form-select" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Dirección</label>
              <select className="form-select" value={filters.sortDirection} onChange={(e) => setFilters((f) => ({ ...f, sortDirection: e.target.value as any }))}>
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </div>
            <div className="col-12 col-lg-2 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', clienteId: '', propiedadId: '', asesorId: '', vencidas: '', sortBy: 'fechaVencimiento', sortDirection: 'asc' })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-list-ul me-2 text-success" /> Listado de reservas</h5>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Vencimiento</th>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Propiedad</th>
                <th>Monto</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data?.data.length && (
                <tr><td colSpan={8} className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando...</td></tr>
              )}
              {!loading && !data?.data.length && (
                <tr><td colSpan={8} className="text-center py-5">
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-receipt-cutoff fs-3" />
                  </div>
                  <div className="fw-semibold">No hay reservas que coincidan con los filtros</div>
                  <div className="text-muted small mb-2">Prueba limpiando los filtros o crea una nueva reserva.</div>
                  <button className="btn btn-success btn-sm" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}><i className="bi bi-plus-lg me-1" /> Crear</button>
                </td></tr>
              )}
              {data?.data.map((r) => {
                const overdue = isOverdue(r);
                return (
                  <tr key={r.id} className={overdue ? 'table-danger bg-opacity-10' : ''}>
                    <td>
                      <div className="fw-semibold small">{formatDate(r.fechaReserva)}</div>
                      <div className="text-muted small" style={{ fontSize: '.78rem' }}>Creada: {formatDateTime(r.createdAt)}</div>
                    </td>
                    <td>
                      <div className={`fw-semibold small ${overdue ? 'text-danger' : ''}`}>
                        {overdue && <i className="bi bi-exclamation-triangle-fill me-1" />}
                        {formatDateTime(r.fechaVencimiento)}
                      </div>
                      {overdue && <span className="badge badge-soft-danger mt-1" style={{ fontSize: '.65rem' }}><i className="bi bi-clock-history me-1" />Vencida</span>}
                      {!overdue && r.estado === 'VENCIDA' && <span className="badge badge-soft-danger mt-1" style={{ fontSize: '.65rem' }}>Vencida</span>}
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(r.cliente.nombres, r.cliente.apellidos)}</span>
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-semibold small lh-1">{r.cliente.nombres} {r.cliente.apellidos}</span>
                            <span className="badge badge-soft-secondary fw-semibold" style={{ fontFamily: 'monospace', fontSize: '.6rem' }} title="ID reserva">
                              <i className="bi bi-upc me-1" />{r.id.slice(0, 10)}…
                            </span>
                          </div>
                          <div className="text-muted small" style={{ fontSize: '.78rem' }}>{r.cliente.celular || r.cliente.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-xs" style={{ background: '#dcfce7', color: '#166534' }}>{initials(r.asesor.nombres, r.asesor.apellidos)}</span>
                        <div>
                          <div className="fw-semibold small">{r.asesor.nombres} {r.asesor.apellidos}</div>
                          <div className="text-muted small" style={{ fontSize: '.78rem' }}>{r.asesor.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold small lh-1">{r.propiedad.nombre}</div>
                      <div className="text-muted small" style={{ fontSize: '.78rem' }}><i className="bi bi-upc me-1" />{r.propiedad.codigoInterno}{r.propiedad.proyecto?.nombre ? ` · ${r.propiedad.proyecto.nombre}` : ''}</div>
                    </td>
                    <td>
                      <div className="fw-bold text-primary">{formatPEN(r.montoSeparacion)}</div>
                    </td>
                    <td>
                      <span className={`badge ${RESERVA_BADGE[r.estado]} fw-semibold`}>{r.estado}</span>
                      {r.observaciones && <div className="text-muted small mt-1" style={{ fontSize: '.72rem', maxWidth: 180 }} title={r.observaciones}>{r.observaciones.length > 40 ? r.observaciones.slice(0, 40) + '…' : r.observaciones}</div>}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        {r.estado === 'ACTIVA' && (
                          <button
                            className="btn btn-sm btn-success"
                            title="Confirmar venta desde esta reserva"
                            onClick={() => {
                              const params = new URLSearchParams({
                                reservaId: r.id,
                                clienteId: r.clienteId,
                                propiedadId: r.propiedadId,
                                asesorId: r.asesorId,
                                from: 'reservas',
                              });
                              router.push(`/ventas?${params.toString()}`);
                            }}
                          >
                            <i className="bi bi-cash-stack me-1" /> Confirmar venta
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          title="Copiar ID de la reserva (para Ventas)"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(r.id);
                              setToast({ ok: true, msg: `✅ ID reserva copiado: ${r.id.slice(0, 10)}…` });
                            } catch {
                              setToast({ ok: false, msg: 'Cópialo manual: ' + r.id });
                            }
                          }}
                        >
                          <i className="bi bi-clipboard" />
                        </button>
                        <button className="btn btn-sm btn-outline-success" title="Editar" onClick={() => { setEditTarget(r); setModalMode('edit'); setModalOpen(true); }}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => eliminar(r.id)}><i className="bi bi-trash3" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="card-footer border-top-0 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="text-muted small">Página {meta.page} / {meta.totalPages}</div>
            <nav><ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${meta.page === 1 ? 'disabled' : ''}`}><button className="page-link" disabled={meta.page === 1} onClick={() => setFilters((f) => ({ ...f, page: 1 }))}><i className="bi bi-chevron-double-left" /></button></li>
              <li className={`page-item ${meta.page === 1 ? 'disabled' : ''}`}><button className="page-link" disabled={meta.page === 1} onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, meta.page - 1) }))}><i className="bi bi-chevron-left" /></button></li>
              {pages.map((p) => <li key={'p'+p} className={`page-item ${p === meta.page ? 'active' : p === '...' ? 'disabled' : ''}`}>
                <button className="page-link" disabled={p === '...'} onClick={() => p !== '...' && setFilters((f) => ({ ...f, page: p as number }))}>{p}</button>
              </li>)}
              <li className={`page-item ${meta.page === meta.totalPages ? 'disabled' : ''}`}><button className="page-link" disabled={meta.page === meta.totalPages} onClick={() => setFilters((f) => ({ ...f, page: Math.min(meta.totalPages, meta.page + 1) }))}><i className="bi bi-chevron-right" /></button></li>
              <li className={`page-item ${meta.page === meta.totalPages ? 'disabled' : ''}`}><button className="page-link" disabled={meta.page === meta.totalPages} onClick={() => setFilters((f) => ({ ...f, page: meta.totalPages }))}><i className="bi bi-chevron-double-right" /></button></li>
            </ul></nav>
          </div>
        )}
      </div>

      <ReservaModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        clientes={clientes}
        asesores={asesores}
        propiedades={propiedades}
        onRefAdd={onRefAdd}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />
    </AppLayout>
  );
}
