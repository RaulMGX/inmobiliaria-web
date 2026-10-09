'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ComisionModal from '@/components/ComisionModal';
import { formatDate, formatDateTime, formatPEN, getSession, http, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  Comision,
  COMISION_BADGE,
  ESTADOS_COMISION,
  EstadoComision,
  FindComisionesQuery,
  Paginated,
  PropiedadLight,
  VentaLight,
} from '@/lib/contratos-comisiones';

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

export default function ComisionesPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindComisionesQuery>({
    page: 1, limit: 10, search: '', estado: '',
    ventaId: '', asesorId: '',
    sortBy: 'fechaGeneracion', sortDirection: 'desc',
  });

  const [data, setData] = useState<Paginated<Comision> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asesores, setAsesores] = useState<AsesorLight[]>([]);
  const [ventas, setVentas] = useState<VentaLight[]>([]);
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadLight[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Comision | null>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindComisionesQuery) => {
    if (!empresaId) return;
    setLoading(true); setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as (keyof FindComisionesQuery)[]).forEach((k) => { const v = q[k]; if (v === '' || v == null) return; params[k] = v; });
      const { data: res } = await http.get<Paginated<Comision>>(`/empresas/${empresaId}/comisiones`, { params });
      setData(res);
      setAsesores((prev) => { const m = new Map(prev.map((a) => [a.id, a])); res.data.forEach((c) => { if (c.asesor) m.set(c.asesor.id, c.asesor); }); return Array.from(m.values()); });
      setClientes((prev) => { const m = new Map(prev.map((c) => [c.id, c])); res.data.forEach((c) => { if (c.venta?.cliente) m.set(c.venta.cliente.id, c.venta.cliente); }); return Array.from(m.values()); });
      setPropiedades((prev) => { const m = new Map(prev.map((p) => [p.id, p])); res.data.forEach((c) => { if (c.venta?.propiedad) m.set(c.venta.propiedad.id, c.venta.propiedad); }); return Array.from(m.values()); });
      setVentas((prev) => {
        const m = new Map(prev.map((v) => [v.id, v]));
        res.data.forEach((c) => {
          if (c.venta) {
            const existing = m.get(c.venta.id);
            m.set(c.venta.id, existing ?? {
              id: c.venta.id, estado: c.venta.estado, fechaVenta: c.venta.fechaVenta,
              totalVenta: c.venta.totalVenta, precioFinal: c.venta.precioFinal,
              cliente: c.venta.cliente, propiedad: c.venta.propiedad,
            });
          }
        });
        return Array.from(m.values());
      });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar las comisiones.');
    } finally { setLoading(false); }
  }, [empresaId]);

  useEffect(() => { fetchPage(filters); /* eslint-disable-next-line */ }, [filters.page, filters.limit, filters.estado, filters.ventaId, filters.asesorId, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    if (!searchRef.current) return;
    const el = searchRef.current;
    const h = () => {
      if (debRef.current) window.clearTimeout(debRef.current);
      debRef.current = window.setTimeout(() => { const q = { ...filters, page: 1, search: el.value }; setFilters(q); fetchPage(q); }, 350);
    };
    el.addEventListener('input', h);
    return () => el.removeEventListener('input', h);
  }, [fetchPage, filters]);

  function onSaved(c: Comision) {
    setModalOpen(false);
    setEditTarget(null);
    if (c.asesor) setAsesores((prev) => prev.find((x) => x.id === c.asesor.id) ? prev : [...prev, c.asesor]);
    if (c.venta) {
      const v = { id: c.venta.id, estado: c.venta.estado, fechaVenta: c.venta.fechaVenta, totalVenta: c.venta.totalVenta, precioFinal: c.venta.precioFinal, cliente: c.venta.cliente, propiedad: c.venta.propiedad };
      setVentas((prev) => prev.find((x) => x.id === v.id) ? prev : [...prev, v]);
      if (c.venta.cliente) setClientes((prev) => prev.find((x) => x.id === c.venta.cliente!.id) ? prev : [...prev, c.venta.cliente!]);
      if (c.venta.propiedad) setPropiedades((prev) => prev.find((x) => x.id === c.venta.propiedad!.id) ? prev : [...prev, c.venta.propiedad!]);
    }
    fetchPage(filters);
  }

  function onRefAdd(kind: 'asesor' | 'venta', ref: any) {
    if (kind === 'asesor') setAsesores((prev) => prev.find((x) => x.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'venta') setVentas((prev) => prev.find((x) => x.id === ref.id) ? prev : [...prev, ref]);
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente esta comisión?')) return;
    try { await http.delete(`/empresas/${empresaId}/comisiones/${id}`); fetchPage(filters); }
    catch (e) { const err = e as AxiosError<any>; setError(err.response?.data?.message ?? 'No se pudo eliminar la comisión.'); }
  }

  const meta = data?.meta;
  const pages = useMemo(() => buildPages(meta?.page ?? 1, meta?.totalPages ?? 1), [meta]);
  const stats = useMemo(() => {
    if (!data?.data) return { total: 0, monto: 0, pagadas: 0, pendientes: 0, aprobadas: 0 };
    let monto = 0, pagadas = 0, pendientes = 0, aprobadas = 0;
    data.data.forEach((c) => {
      monto += parseFloat(c.montoComision || '0');
      if (c.estado === 'PAGADA') pagadas++;
      else if (c.estado === 'APROBADA') aprobadas++;
      else if (c.estado !== 'ANULADA') pendientes++;
    });
    return { total: meta?.total ?? 0, monto, pagadas, pendientes, aprobadas };
  }, [data, meta]);

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Comisiones</h1>
          <p className="page-subtitle">Gestiona las comisiones de asesores por cada venta cerrada.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0'}</div>
          <button className="btn btn-sm btn-success d-flex align-items-center gap-2" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}>
            <i className="bi bi-plus-lg" /> Nueva comisión
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatCard icon="bi-wallet2" color="#dcfce7|#166534" label="Total" value={stats.total.toString()} />
        <StatCard icon="bi-check2-circle" color="#d1fae5|#065f46" label="Pagadas" value={stats.pagadas.toString()} accent="text-success" />
        <StatCard icon="bi-hourglass-split" color="#eef2ff|#3730a3" label="Aprobadas" value={stats.aprobadas.toString()} accent="text-primary" />
        <StatCard icon="bi-cash-coin" color="#fef3c7|#92400e" label="Monto total" value={formatPEN(stats.monto)} />
      </div>

      {error && <div className="alert alert-danger small mb-4 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-4">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-success" /> Filtros</h5></div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <label className="form-label small fw-semibold">Buscar</label>
              <div className="input-group">
                <span className="input-group-text bg-white text-muted"><i className="bi bi-search" /></span>
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Asesor, cliente, propiedad, observaciones..." />
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Estado</label>
              <select className="form-select" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoComision) || '' }))}>
                <option value="">Todos</option>{ESTADOS_COMISION.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Asesor</label>
              <select className="form-select" value={filters.asesorId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, asesorId: e.target.value }))}>
                <option value="">Todos</option>{asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Venta (ID)</label>
              <select className="form-select" value={filters.ventaId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, ventaId: e.target.value }))}>
                <option value="">Todas</option>{ventas.map((v) => <option key={v.id} value={v.id}>{v.id.slice(0, 10)}… · {formatPEN(v.totalVenta)}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Ordenar</label>
              <select className="form-select" value={filters.sortBy} onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as any }))}>
                <option value="fechaGeneracion">Generación</option>
                <option value="fechaPago">Pago</option>
                <option value="montoComision">Monto</option>
                <option value="porcentajeComision">Porcentaje</option>
                <option value="estado">Estado</option>
                <option value="createdAt">Creado</option>
                <option value="updatedAt">Actualizado</option>
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
                <option value="asc">Ascendente</option><option value="desc">Descendente</option>
              </select>
            </div>
            <div className="col-12 col-lg-2 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', ventaId: '', asesorId: '', sortBy: 'fechaGeneracion', sortDirection: 'desc' })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-list-ul me-2 text-success" /> Listado de comisiones</h5></div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Venta / Cliente</th>
                <th>Asesor</th>
                <th>Propiedad</th>
                <th>% Com</th>
                <th>Monto</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data?.data.length && (<tr><td colSpan={8} className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando...</td></tr>)}
              {!loading && !data?.data.length && (
                <tr><td colSpan={8} className="text-center py-5">
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-wallet2 fs-3" />
                  </div>
                  <div className="fw-semibold">No hay comisiones que coincidan con los filtros</div>
                  <div className="text-muted small mb-2">Prueba limpiando los filtros o crea una nueva comisión.</div>
                  <button className="btn btn-success btn-sm" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}><i className="bi bi-plus-lg me-1" /> Crear</button>
                </td></tr>
              )}
              {data?.data.map((c) => {
                const v = c.venta;
                const pct = parseFloat(c.porcentajeComision || '0');
                const tv = v ? parseFloat(v.totalVenta || '0') : 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(v?.cliente.nombres || '?', v?.cliente.apellidos || null)}</span>
                        <div>
                          <div className="fw-semibold small lh-1">{v?.cliente.nombres} {v?.cliente.apellidos}</div>
                          <div className="text-muted small" style={{ fontFamily: 'monospace', fontSize: '.78rem' }}>{c.ventaId.slice(0, 10)}… · {formatPEN(tv)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-xs" style={{ background: '#dcfce7', color: '#166534' }}>{initials(c.asesor.nombres, c.asesor.apellidos)}</span>
                        <div>
                          <div className="fw-semibold small">{c.asesor.nombres} {c.asesor.apellidos}</div>
                          <div className="text-muted small" style={{ fontSize: '.78rem' }}>{c.asesor.correo || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold small lh-1">{v?.propiedad.nombre}</div>
                      <div className="text-muted small" style={{ fontSize: '.78rem' }}><i className="bi bi-upc me-1" />{v?.propiedad.codigoInterno}{v?.propiedad.proyecto?.nombre ? ` · ${v?.propiedad.proyecto.nombre}` : ''}</div>
                    </td>
                    <td>
                      <div className="fw-semibold">{pct.toFixed(2)}%</div>
                      {tv > 0 && (<div className="text-muted small" style={{ fontSize: '.75rem' }}>sobre {formatPEN(tv)}</div>)}
                    </td>
                    <td><div className="fw-bold text-primary">{formatPEN(c.montoComision)}</div></td>
                    <td>
                      <div className="small"><span className="text-muted">Gen:</span> {formatDate(c.fechaGeneracion)}</div>
                      <div className="small"><span className="text-muted">Pago:</span> {c.fechaPago ? formatDate(c.fechaPago) : '—'}</div>
                    </td>
                    <td>
                      <span className={`badge ${COMISION_BADGE[c.estado]} fw-semibold`}>{c.estado}</span>
                      {c.observaciones && <div className="text-muted small mt-1" style={{ fontSize: '.72rem', maxWidth: 200 }} title={c.observaciones}>{c.observaciones.length > 35 ? c.observaciones.slice(0, 35) + '…' : c.observaciones}</div>}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button className="btn btn-sm btn-outline-success" title="Editar" onClick={() => { setEditTarget(c); setModalMode('edit'); setModalOpen(true); }}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => eliminar(c.id)}><i className="bi bi-trash3" /></button>
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
              {pages.map((p) => <li key={'p'+p} className={`page-item ${p === meta.page ? 'active' : p === '...' ? 'disabled' : ''}`}><button className="page-link" disabled={p === '...'} onClick={() => p !== '...' && setFilters((f) => ({ ...f, page: p as number }))}>{p}</button></li>)}
              <li className={`page-item ${meta.page === meta.totalPages ? 'disabled' : ''}`}><button className="page-link" disabled={meta.page === meta.totalPages} onClick={() => setFilters((f) => ({ ...f, page: Math.min(meta.totalPages, meta.page + 1) }))}><i className="bi bi-chevron-right" /></button></li>
              <li className={`page-item ${meta.page === meta.totalPages ? 'disabled' : ''}`}><button className="page-link" disabled={meta.page === meta.totalPages} onClick={() => setFilters((f) => ({ ...f, page: meta.totalPages }))}><i className="bi bi-chevron-double-right" /></button></li>
            </ul></nav>
          </div>
        )}
      </div>

      <ComisionModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        asesores={asesores}
        ventas={ventas}
        onRefAdd={onRefAdd}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />
    </AppLayout>
  );
}

function StatCard({ icon, color, label, value, accent }: { icon: string; color: string; label: string; value: string; accent?: string }) {
  const [bg, fg] = color.split('|');
  return (
    <div className="col-6 col-md-3">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body p-3 d-flex align-items-center gap-3">
          <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`bi ${icon} fs-5`} />
          </div>
          <div>
            <div className="text-muted small" style={{ fontSize: '.78rem' }}>{label}</div>
            <div className={`fw-bold fs-5 ${accent || ''}`}>{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
