'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import PagoModal from '@/components/PagoModal';
import { formatDate, formatDateTime, formatPEN, getSession, http, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  ESTADOS_PAGO,
  EstadoPago,
  FindPagosQuery,
  METODOS_PAGO,
  MetodoPagoPago,
  Paginated,
  PAGO_BADGE,
  Pago,
  PropiedadLight,
  Venta,
} from '@/lib/ventas-pagos';

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

export default function PagosPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindPagosQuery>({
    page: 1, limit: 10, search: '', estado: '', metodoPago: '',
    ventaId: '', clienteId: '', registradoPorId: '',
    sortBy: 'createdAt', sortDirection: 'desc',
  });

  const [data, setData] = useState<Paginated<Pago> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [asesores, setAsesores] = useState<AsesorLight[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadLight[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Pago | null>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindPagosQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as (keyof FindPagosQuery)[]).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null) return;
        params[k] = v;
      });
      const { data: res } = await http.get<Paginated<Pago>>(`/empresas/${empresaId}/pagos`, { params });
      setData(res);
      setClientes((prev) => {
        const m = new Map(prev.map((c) => [c.id, c]));
        res.data.forEach((p) => { if (p.venta?.cliente) m.set(p.venta.cliente.id, p.venta.cliente); });
        return Array.from(m.values());
      });
      setAsesores((prev) => {
        const m = new Map(prev.map((a) => [a.id, a]));
        res.data.forEach((p) => {
          if (p.venta?.asesor) m.set(p.venta.asesor.id, p.venta.asesor);
          if (p.registradoPor) m.set(p.registradoPor.id, p.registradoPor);
        });
        return Array.from(m.values());
      });
      setPropiedades((prev) => {
        const m = new Map(prev.map((x) => [x.id, x]));
        res.data.forEach((p) => { if (p.venta?.propiedad) m.set(p.venta.propiedad.id, p.venta.propiedad); });
        return Array.from(m.values());
      });
      setVentas((prev) => {
        const m = new Map(prev.map((v) => [v.id, v]));
        res.data.forEach((p) => {
          if (p.venta) {
            const existing = m.get(p.venta.id);
            m.set(p.venta.id, existing ?? ({
              id: p.venta.id,
              empresaId,
              reservaId: '',
              clienteId: p.venta.cliente.id,
              propiedadId: p.venta.propiedad.id,
              asesorId: p.venta.asesor.id,
              estado: p.venta.estado,
              metodoPago: 'CONTADO',
              fechaVenta: p.venta.fechaVenta,
              precioFinal: p.venta.totalVenta,
              descuento: '0',
              impuestos: '0',
              totalVenta: p.venta.totalVenta,
              saldoPendiente: p.venta.saldoPendiente,
              observaciones: null,
              active: true,
              deletedAt: null,
              createdAt: '',
              updatedAt: '',
              cliente: p.venta.cliente,
              propiedad: p.venta.propiedad,
              reserva: { id: '', estado: '', fechaReserva: '', fechaVencimiento: '', montoSeparacion: '0' },
              asesor: p.venta.asesor,
            } as Venta));
          }
        });
        return Array.from(m.values());
      });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar los pagos.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.estado, filters.metodoPago, filters.ventaId, filters.clienteId, filters.registradoPorId, filters.sortBy, filters.sortDirection]);

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

  function onSaved(_p: Pago) {
    setModalOpen(false);
    setEditTarget(null);
    fetchPage(filters);
  }

  function onVentaRefAdd(ref: Venta) {
    setVentas((prev) => prev.find((v) => v.id === ref.id) ? prev : [...prev, ref]);
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente este pago?')) return;
    try {
      await http.delete(`/empresas/${empresaId}/pagos/${id}`);
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar el pago.');
    }
  }

  const meta = data?.meta;
  const pages = useMemo(() => buildPages(meta?.page ?? 1, meta?.totalPages ?? 1), [meta]);

  const stats = useMemo(() => {
    if (!data?.data) return { total: 0, monto: 0, pagados: 0, pendientes: 0, saldoTotal: 0 };
    let monto = 0, pagados = 0, pendientes = 0;
    const salesSeen = new Map<string, number>();
    data.data.forEach((p) => {
      const m = parseFloat(p.monto || '0');
      if (p.estado === 'PAGADO') { monto += m; pagados++; }
      else pendientes++;
      if (p.venta) salesSeen.set(p.venta.id, parseFloat(p.venta.saldoPendiente || '0'));
    });
    let saldoTotal = 0;
    salesSeen.forEach((v) => { saldoTotal += v; });
    return { total: meta?.total ?? 0, monto, pagados, pendientes, saldoTotal };
  }, [data, meta]);

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Pagos</h1>
          <p className="page-subtitle">Gestiona los pagos de las ventas y su saldo pendiente.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">
            Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0'}
          </div>
          <button className="btn btn-sm btn-success d-flex align-items-center gap-2" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}>
            <i className="bi bi-plus-lg" /> Registrar pago
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-cash-coin fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Pagos</div>
                <div className="fw-bold fs-5">{stats.total}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-check2-circle fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Cobrados</div>
                <div className="fw-bold fs-5 text-success">{stats.pagados}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-wallet2 fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Cobrado pág.</div>
                <div className="fw-bold fs-5">{formatPEN(stats.monto)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-hourglass-split fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Saldos pend.</div>
                <div className="fw-bold fs-5 text-warning">{formatPEN(stats.saldoTotal)}</div>
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
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Operación, cliente, propiedad, observaciones..." />
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Estado</label>
              <select className="form-select" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoPago) || '' }))}>
                <option value="">Todos</option>
                {ESTADOS_PAGO.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Método pago</label>
              <select className="form-select" value={filters.metodoPago} onChange={(e) => setFilters((f) => ({ ...f, page: 1, metodoPago: (e.target.value as MetodoPagoPago) || '' }))}>
                <option value="">Todos</option>
                {METODOS_PAGO.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
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
              <label className="form-label small fw-semibold">Registrado por</label>
              <select className="form-select" value={filters.registradoPorId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, registradoPorId: e.target.value }))}>
                <option value="">Todos</option>
                {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Venta (ID)</label>
              <select className="form-select" value={filters.ventaId} onChange={(e) => setFilters((f) => ({ ...f, page: 1, ventaId: e.target.value }))}>
                <option value="">Todas</option>
                {ventas.map((v) => <option key={v.id} value={v.id}>{v.id.slice(0, 10)}… · {v.cliente.nombres} {v.cliente.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Ordenar por</label>
              <select className="form-select" value={filters.sortBy} onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as any }))}>
                <option value="createdAt">Creado</option>
                <option value="fechaPago">Fecha pago</option>
                <option value="fechaVencimiento">Vence</option>
                <option value="monto">Monto</option>
                <option value="estado">Estado</option>
                <option value="updatedAt">Actualizado</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Mostrar</label>
              <select className="form-select" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
            <div className="col-12 col-lg-2 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', metodoPago: '', ventaId: '', clienteId: '', registradoPorId: '', sortBy: 'createdAt', sortDirection: 'desc' })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-list-ul me-2 text-success" /> Listado de pagos</h5>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Venta / Cliente</th>
                <th>Fecha pago</th>
                <th>Vence</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Operación</th>
                <th>Saldo pend.</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data?.data.length && (
                <tr><td colSpan={9} className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando...</td></tr>
              )}
              {!loading && !data?.data.length && (
                <tr><td colSpan={9} className="text-center py-5">
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-cash-coin fs-3" />
                  </div>
                  <div className="fw-semibold">No hay pagos que coincidan con los filtros</div>
                  <div className="text-muted small mb-2">Prueba limpiando los filtros o registra un nuevo pago.</div>
                  <button className="btn btn-success btn-sm" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}><i className="bi bi-plus-lg me-1" /> Registrar</button>
                </td></tr>
              )}
              {data?.data.map((p) => {
                const v = p.venta;
                const vencido = p.estado !== 'PAGADO' && p.estado !== 'ANULADO' && p.fechaVencimiento && new Date(p.fechaVencimiento).getTime() < Date.now();
                const sp = v ? parseFloat(v.saldoPendiente || '0') : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(v?.cliente.nombres || '?', v?.cliente.apellidos || null)}</span>
                        <div>
                          <div className="fw-semibold small lh-1">{v?.cliente.nombres} {v?.cliente.apellidos}</div>
                          <div className="text-muted small" style={{ fontSize: '.78rem' }}>Venta {v?.id.slice(0, 8)}… · [{v?.propiedad.codigoInterno}] {v?.propiedad.nombre}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold small">{p.fechaPago ? formatDateTime(p.fechaPago) : <span className="text-muted">—</span>}</div>
                      {p.numeroCuota != null && <div className="text-muted small" style={{ fontSize: '.78rem' }}>Cuota N° {p.numeroCuota}</div>}
                    </td>
                    <td>
                      <div className={`fw-semibold small ${vencido ? 'text-danger' : ''}`}>
                        {p.fechaVencimiento ? formatDate(p.fechaVencimiento) : <span className="text-muted">—</span>}
                      </div>
                      {vencido && <span className="badge badge-soft-danger mt-1" style={{ fontSize: '.65rem' }}><i className="bi bi-clock-history me-1" />Vencido</span>}
                    </td>
                    <td>
                      <div className="fw-bold text-primary">{formatPEN(p.monto)}</div>
                    </td>
                    <td>
                      <div className="small">{p.metodoPago ? p.metodoPago.replace(/_/g, ' ') : <span className="text-muted">—</span>}</div>
                      {p.registradoPor && <div className="text-muted small" style={{ fontSize: '.75rem' }}>Por: {p.registradoPor.nombres} {p.registradoPor.apellidos}</div>}
                    </td>
                    <td>
                      <div className="small" style={{ fontFamily: 'monospace' }}>{p.numeroOperacion || <span className="text-muted">—</span>}</div>
                      {p.observaciones && <div className="text-muted small mt-1" style={{ fontSize: '.72rem', maxWidth: 200 }} title={p.observaciones}>{p.observaciones.length > 30 ? p.observaciones.slice(0, 30) + '…' : p.observaciones}</div>}
                    </td>
                    <td>
                      {sp != null && (
                        <div className={`fw-bold ${sp > 0 ? 'text-danger' : 'text-success'}`}>{formatPEN(sp)}</div>
                      )}
                      {sp == null && <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${PAGO_BADGE[p.estado]} fw-semibold`}>{p.estado}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button className="btn btn-sm btn-outline-success" title="Editar" onClick={() => { setEditTarget(p); setModalMode('edit'); setModalOpen(true); }}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => eliminar(p.id)}><i className="bi bi-trash3" /></button>
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

      <PagoModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        ventas={ventas}
        onVentaRefAdd={onVentaRefAdd}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />
    </AppLayout>
  );
}
