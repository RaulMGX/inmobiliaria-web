'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ContratoModal from '@/components/ContratoModal';
import { formatDate, formatDateTime, formatPEN, getSession, http, initials } from '@/lib/api';
import {
  ClienteLight,
  CONTRATO_BADGE,
  Contrato,
  ESTADOS_CONTRATO,
  EstadoContrato,
  FindContratosQuery,
  Paginated,
  PropiedadLight,
  ResponsableLight,
  TIPOS_CONTRATO,
  TipoContrato,
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

export default function ContratosPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindContratosQuery>({
    page: 1, limit: 10, search: '', estado: '', tipo: '',
    ventaId: '', clienteId: '', propiedadId: '', responsableId: '',
    sortBy: 'fechaEmision', sortDirection: 'desc',
  });

  const [data, setData] = useState<Paginated<Contrato> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [responsables, setResponsables] = useState<ResponsableLight[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadLight[]>([]);
  const [ventas, setVentas] = useState<VentaLight[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Contrato | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Contrato | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const detailBsRef = useRef<any>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindContratosQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as (keyof FindContratosQuery)[]).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null) return;
        params[k] = v;
      });
      const { data: res } = await http.get<Paginated<Contrato>>(`/empresas/${empresaId}/contratos`, { params });
      setData(res);
      setClientes((prev) => { const m = new Map(prev.map((c) => [c.id, c])); res.data.forEach((c) => { if (c.cliente) m.set(c.cliente.id, c.cliente); }); return Array.from(m.values()); });
      setResponsables((prev) => { const m = new Map(prev.map((a) => [a.id, a])); res.data.forEach((c) => { if (c.responsable) m.set(c.responsable.id, c.responsable); }); return Array.from(m.values()); });
      setPropiedades((prev) => { const m = new Map(prev.map((p) => [p.id, p])); res.data.forEach((c) => { if (c.propiedad) m.set(c.propiedad.id, c.propiedad); }); return Array.from(m.values()); });
      setVentas((prev) => { const m = new Map(prev.map((v) => [v.id, v])); res.data.forEach((c) => { if (c.venta) m.set(c.venta.id, c.venta); }); return Array.from(m.values()); });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar los contratos.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { fetchPage(filters); /* eslint-disable-next-line */ }, [filters.page, filters.limit, filters.estado, filters.tipo, filters.ventaId, filters.clienteId, filters.propiedadId, filters.responsableId, filters.sortBy, filters.sortDirection]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!detailRef.current) return;
    const B = (window as any).bootstrap;
    if (!detailBsRef.current && B?.Modal) { detailBsRef.current = new B.Modal(detailRef.current, { backdrop: 'static', keyboard: false }); }
    if (detailBsRef.current) { if (detailOpen) detailBsRef.current.show(); else detailBsRef.current.hide(); }
  }, [detailOpen]);

  async function openDetail(id: string) {
    if (!empresaId) return;
    setDetail(null);
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const { data } = await http.get<Contrato>(`/empresas/${empresaId}/contratos/${id}`);
      setDetail(data);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  }

  function onSaved(c: Contrato) {
    setModalOpen(false);
    setEditTarget(null);
    if (c.cliente) setClientes((prev) => prev.find((x) => x.id === c.cliente.id) ? prev : [...prev, c.cliente]);
    if (c.responsable) setResponsables((prev) => prev.find((x) => x.id === c.responsable.id) ? prev : [...prev, c.responsable]);
    if (c.propiedad) setPropiedades((prev) => prev.find((x) => x.id === c.propiedad.id) ? prev : [...prev, c.propiedad]);
    if (c.venta) setVentas((prev) => prev.find((x) => x.id === c.venta.id) ? prev : [...prev, c.venta]);
    fetchPage(filters);
  }

  function onRefAdd(kind: 'cliente' | 'asesor' | 'propiedad' | 'responsable' | 'venta', ref: any) {
    if (kind === 'cliente') setClientes((prev) => prev.find((x) => x.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'asesor' || kind === 'responsable') setResponsables((prev) => prev.find((x) => x.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'propiedad') setPropiedades((prev) => prev.find((x) => x.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'venta') setVentas((prev) => prev.find((x) => x.id === ref.id) ? prev : [...prev, ref]);
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente este contrato?')) return;
    try {
      await http.delete(`/empresas/${empresaId}/contratos/${id}`);
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar el contrato.');
    }
  }

  const meta = data?.meta;
  const pages = useMemo(() => buildPages(meta?.page ?? 1, meta?.totalPages ?? 1), [meta]);
  const stats = useMemo(() => {
    if (!data?.data) return { total: 0, monto: 0, firmados: 0, pendientes: 0 };
    let monto = 0, firmados = 0, pendientes = 0;
    data.data.forEach((c) => {
      monto += parseFloat(c.montoContrato || '0');
      if (c.estado === 'FIRMADO') firmados++;
      else if (c.estado !== 'ANULADO') pendientes++;
    });
    return { total: meta?.total ?? 0, monto, firmados, pendientes };
  }, [data, meta]);

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Contratos</h1>
          <p className="page-subtitle">Gestiona los contratos firmados y pendientes de tu cartera inmobiliaria.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0'}</div>
          <button className="btn btn-sm btn-primary d-flex align-items-center gap-2" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}>
            <i className="bi bi-plus-lg" /> Nuevo contrato
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatCard icon="bi-file-earmark-richtext" color="#eef2ff|#3730a3" label="Total" value={stats.total.toString()} />
        <StatCard icon="bi-pen-fill" color="#dcfce7|#166534" label="Firmados" value={stats.firmados.toString()} accent="text-success" />
        <StatCard icon="bi-clock-history" color="#fef3c7|#92400e" label="Pend. firma" value={stats.pendientes.toString()} accent="text-warning" />
        <StatCard icon="bi-cash-stack" color="#fce7f3|#9d174d" label="Monto total" value={formatPEN(stats.monto)} />
      </div>

      {error && <div className="alert alert-danger small mb-4 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-4">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5></div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <label className="form-label small fw-semibold">Buscar</label>
              <div className="input-group">
                <span className="input-group-text bg-white text-muted"><i className="bi bi-search" /></span>
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Número, cliente, propiedad, responsable..." />
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Estado</label>
              <select className="form-select" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoContrato) || '' }))}>
                <option value="">Todos</option>{ESTADOS_CONTRATO.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Tipo</label>
              <select className="form-select" value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, page: 1, tipo: (e.target.value as TipoContrato) || '' }))}>
                <option value="">Todos</option>{TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Cliente</label>
              <select className="form-select" value={filters.clienteId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, clienteId: e.target.value }))}>
                <option value="">Todos</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Responsable</label>
              <select className="form-select" value={filters.responsableId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, responsableId: e.target.value }))}>
                <option value="">Todos</option>{responsables.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Propiedad</label>
              <select className="form-select" value={filters.propiedadId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, propiedadId: e.target.value }))}>
                <option value="">Todas</option>{propiedades.map((p) => <option key={p.id} value={p.id}>[{p.codigoInterno}] {p.nombre}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Ordenar</label>
              <select className="form-select" value={filters.sortBy} onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as any }))}>
                <option value="fechaEmision">Emisión</option>
                <option value="fechaFirma">Firma</option>
                <option value="montoContrato">Monto</option>
                <option value="version">Versión</option>
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
              <button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', tipo: '', ventaId: '', clienteId: '', propiedadId: '', responsableId: '', sortBy: 'fechaEmision', sortDirection: 'desc' })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-list-ul me-2 text-primary" /> Listado de contratos</h5></div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Número / Versión</th>
                <th>Venta</th>
                <th>Cliente</th>
                <th>Responsable</th>
                <th>Propiedad</th>
                <th>Fechas</th>
                <th>Monto</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data?.data.length && (<tr><td colSpan={9} className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando...</td></tr>)}
              {!loading && !data?.data.length && (
                <tr><td colSpan={9} className="text-center py-5">
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#eef2ff', color: '#3730a3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-file-earmark-richtext fs-3" />
                  </div>
                  <div className="fw-semibold">No hay contratos que coincidan con los filtros</div>
                  <div className="text-muted small mb-2">Prueba limpiando los filtros o crea un nuevo contrato.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}><i className="bi bi-plus-lg me-1" /> Crear</button>
                </td></tr>
              )}
              {data?.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="fw-semibold small" style={{ fontFamily: 'monospace' }}>{c.numeroContrato}</div>
                    <div className="text-muted small" style={{ fontSize: '.78rem' }}>v{c.version} · {c.tipo}</div>
                  </td>
                  <td>
                    <div className="fw-semibold small" style={{ fontFamily: 'monospace' }}>{c.ventaId.slice(0, 8)}…</div>
                    <div className="text-muted small" style={{ fontSize: '.78rem' }}>{formatDate(c.venta.fechaVenta)} · {formatPEN(c.venta.totalVenta)}</div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(c.cliente.nombres, c.cliente.apellidos)}</span>
                      <div><div className="fw-semibold small lh-1">{c.cliente.nombres} {c.cliente.apellidos}</div><div className="text-muted small" style={{ fontSize: '.78rem' }}>{c.cliente.celular || c.cliente.correo}</div></div>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="avatar-xs" style={{ background: '#dcfce7', color: '#166534' }}>{initials(c.responsable.nombres, c.responsable.apellidos)}</span>
                      <div><div className="fw-semibold small">{c.responsable.nombres} {c.responsable.apellidos}</div><div className="text-muted small" style={{ fontSize: '.78rem' }}>{c.responsable.correo}</div></div>
                    </div>
                  </td>
                  <td>
                    <div className="fw-semibold small lh-1">{c.propiedad.nombre}</div>
                    <div className="text-muted small" style={{ fontSize: '.78rem' }}><i className="bi bi-upc me-1" />{c.propiedad.codigoInterno}{c.propiedad.proyecto?.nombre ? ` · ${c.propiedad.proyecto.nombre}` : ''}</div>
                  </td>
                  <td>
                    <div className="small"><span className="text-muted">Emi:</span> {formatDate(c.fechaEmision)}</div>
                    <div className="small"><span className="text-muted">Fir:</span> {c.fechaFirma ? formatDate(c.fechaFirma) : '—'}</div>
                    <div className="small"><span className="text-muted">Venc:</span> {c.fechaVencimiento ? formatDate(c.fechaVencimiento) : '—'}</div>
                  </td>
                  <td><div className="fw-bold text-primary">{formatPEN(c.montoContrato)}</div></td>
                  <td><span className={`badge ${CONTRATO_BADGE[c.estado]} fw-semibold`}>{c.estado.replace(/_/g, ' ')}</span></td>
                  <td className="text-end">
                    <div className="d-inline-flex gap-1">
                      <button className="btn btn-sm btn-outline-info" title="Detalle" onClick={() => openDetail(c.id)}><i className="bi bi-eye" /></button>
                      <button className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => { setEditTarget(c); setModalMode('edit'); setModalOpen(true); }}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => eliminar(c.id)}><i className="bi bi-trash3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
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

      <ContratoModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        clientes={clientes}
        asesores={responsables}
        propiedades={propiedades}
        ventas={ventas}
        onRefAdd={onRefAdd}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <div className="modal fade" id="contratoDetailModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={detailRef}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5 fw-bold"><i className="bi bi-receipt me-2 text-info" />Detalle de contrato</h1>
              <button type="button" className="btn-close" disabled={detailLoading} onClick={() => setDetailOpen(false)} aria-label="Close" />
            </div>
            <div className="modal-body">
              {detailLoading && !detail && (<div className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando detalle...</div>)}
              {!detailLoading && detail && (
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="p-3 rounded border mb-3 bg-light">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <div>
                          <div className="fw-bold fs-5" style={{ fontFamily: 'monospace' }}>{detail.numeroContrato}</div>
                          <div className="text-muted small">v{detail.version} · {detail.tipo}</div>
                        </div>
                        <span className={`badge ${CONTRATO_BADGE[detail.estado]} fw-semibold px-2 py-1`}>{detail.estado.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Cliente</h6>
                    <div className="d-flex align-items-center gap-3 mb-3 p-3 rounded border">
                      <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(detail.cliente.nombres, detail.cliente.apellidos)}</span>
                      <div><div className="fw-semibold">{detail.cliente.nombres} {detail.cliente.apellidos}</div><div className="text-muted small">{detail.cliente.correo || '—'}</div><div className="text-muted small">{detail.cliente.celular || '—'}</div></div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Responsable</h6>
                    <div className="d-flex align-items-center gap-3 mb-3 p-3 rounded border">
                      <span className="avatar-xs" style={{ background: '#dcfce7', color: '#166534' }}>{initials(detail.responsable.nombres, detail.responsable.apellidos)}</span>
                      <div><div className="fw-semibold">{detail.responsable.nombres} {detail.responsable.apellidos}</div><div className="text-muted small">{detail.responsable.correo || '—'}</div></div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Propiedad</h6>
                    <div className="p-3 rounded border">
                      <div className="fw-semibold">{detail.propiedad.nombre}</div>
                      <div className="text-muted small">Código: {detail.propiedad.codigoInterno}</div>
                      <div className="text-muted small">Proyecto: {detail.propiedad.proyecto?.nombre || '—'}</div>
                      <div className="text-muted small">Estado: {detail.propiedad.estado}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="row g-2 mb-3">
                      <div className="col-4"><label className="form-label small fw-semibold text-muted">Venta</label><div className="fw-mono small" style={{ fontFamily: 'monospace' }}>{detail.ventaId.slice(0, 12)}…</div></div>
                      <div className="col-4"><label className="form-label small fw-semibold text-muted">Emisión</label><div className="fw-semibold">{formatDate(detail.fechaEmision)}</div></div>
                      <div className="col-4"><label className="form-label small fw-semibold text-muted">Firma</label><div className="fw-semibold">{detail.fechaFirma ? formatDate(detail.fechaFirma) : '—'}</div></div>
                      <div className="col-4"><label className="form-label small fw-semibold text-muted">Vence</label><div className="fw-semibold">{detail.fechaVencimiento ? formatDate(detail.fechaVencimiento) : '—'}</div></div>
                      <div className="col-4"><label className="form-label small fw-semibold text-muted">Creado</label><div className="small">{formatDateTime(detail.createdAt)}</div></div>
                      <div className="col-4"><label className="form-label small fw-semibold text-muted">Actualizado</label><div className="small">{formatDateTime(detail.updatedAt)}</div></div>
                    </div>
                    <div className="card border-0 bg-light mb-3">
                      <div className="card-body p-3">
                        <h6 className="fw-semibold small text-uppercase text-muted mb-2">Montos</h6>
                        <div className="d-flex justify-content-between mb-1"><span className="text-muted small">Venta total</span><span className="fw-semibold">{formatPEN(detail.venta.totalVenta)}</span></div>
                        {detail.venta.saldoPendiente != null && (<div className="d-flex justify-content-between mb-1"><span className="text-muted small">Saldo pendiente</span><span className={`fw-bold ${parseFloat(detail.venta.saldoPendiente || '0') > 0 ? 'text-danger' : 'text-success'}`}>{formatPEN(detail.venta.saldoPendiente)}</span></div>)}
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between"><span className="fw-semibold">Monto contrato</span><span className="fw-bold text-primary fs-5">{formatPEN(detail.montoContrato)}</span></div>
                      </div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Documento</h6>
                    <div className="p-3 rounded border row g-2 mb-3 bg-white">
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-muted mb-1">Ruta PDF</label>
                        <div className="small break-all">{detail.rutaPdfFirmado || <span className="text-muted">—</span>}</div>
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-muted mb-1">Hash</label>
                        <div className="small" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{detail.hashDocumento || <span className="text-muted">—</span>}</div>
                      </div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Observaciones</h6>
                    <div className="p-3 rounded border bg-white" style={{ minHeight: 72 }}>{detail.observaciones || <span className="text-muted">Sin observaciones.</span>}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailOpen(false)}>Cerrar</button>
              {detail && (
                <button type="button" className="btn btn-primary" onClick={() => { setEditTarget(detail); setDetailOpen(false); setModalMode('edit'); setModalOpen(true); }}>
                  <i className="bi bi-pencil me-1" />Editar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
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
