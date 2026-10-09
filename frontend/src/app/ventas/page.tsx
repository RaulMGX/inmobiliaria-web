'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import VentaModal from '@/components/VentaModal';
import { formatDate, formatDateTime, formatPEN, getSession, http, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  ESTADOS_VENTA,
  EstadoVenta,
  FindVentasQuery,
  METODOS_VENTA,
  MetodoPagoVenta,
  Paginated,
  PropiedadLight,
  ReservaLight,
  VENTA_BADGE,
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

export default function VentasPage() {
  const searchParams = useSearchParams();
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindVentasQuery>({
    page: 1, limit: 10, search: '', estado: '', metodoPago: '',
    clienteId: '', propiedadId: '', reservaId: '', asesorId: '',
    sortBy: 'fechaVenta', sortDirection: 'desc',
  });

  const yoAsesor: AsesorLight | null = useMemo(() => {
    if (!sess?.usuario?.id) return null;
    return { id: sess.usuario.id, nombres: sess.usuario.nombres || '', apellidos: sess.usuario.apellidos || '', correo: (sess.usuario.correo || null) as any };
  }, [sess]);

  const [refsToken, setRefsToken] = useState(0);
  const handleRefreshRefs = () => setRefsToken((n) => n + 1);

  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }

  const [data, setData] = useState<Paginated<Venta> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [asesores, setAsesores] = useState<AsesorLight[]>(yoAsesor ? [yoAsesor] : []);
  const [propiedades, setPropiedades] = useState<PropiedadLight[]>([]);
  const [reservas, setReservas] = useState<ReservaLight[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Venta | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Venta | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const detailBsRef = useRef<any>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindVentasQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as (keyof FindVentasQuery)[]).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null) return;
        params[k] = v;
      });
      const { data: res } = await http.get<Paginated<Venta>>(`/empresas/${empresaId}/ventas`, { params });
      setData(res);
      setClientes((prev) => {
        const m = new Map(prev.map((c) => [c.id, c]));
        res.data.forEach((v) => { if (v.cliente) m.set(v.cliente.id, v.cliente); });
        return Array.from(m.values());
      });
      setAsesores((prev) => {
        const m = new Map(prev.map((a) => [a.id, a]));
        res.data.forEach((v) => { if (v.asesor) m.set(v.asesor.id, v.asesor); });
        return Array.from(m.values());
      });
      setPropiedades((prev) => {
        const m = new Map(prev.map((p) => [p.id, p]));
        res.data.forEach((v) => { if (v.propiedad) m.set(v.propiedad.id, v.propiedad); });
        return Array.from(m.values());
      });
      setReservas((prev) => {
        const m = new Map(prev.map((r) => [r.id, r]));
        res.data.forEach((v) => { if (v.reserva) m.set(v.reserva.id, v.reserva); });
        return Array.from(m.values());
      });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar las ventas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.estado, filters.metodoPago, filters.clienteId, filters.propiedadId, filters.reservaId, filters.asesorId, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      try {
        const [resCli, resProp, resRes] = await Promise.allSettled([
          http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }),
          http.get<any>(`/empresas/${empresaId}/propiedades`, { params: { page: 1, limit: 100 } }),
          http.get<any>(`/empresas/${empresaId}/reservas`, { params: { page: 1, limit: 100 } }),
        ]);
        if (resCli.status === 'fulfilled') {
          const listCli = (resCli.value.data?.data ?? resCli.value.data ?? []) as any[];
          setClientes((prev) => {
            const m = new Map(prev.map((c) => [c.id, c]));
            listCli.forEach((c) => m.set(c.id, { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, estado: c.estado || 'NUEVO' } as ClienteLight));
            return Array.from(m.values());
          });
        } else {
          console.error('[VentasPage] Error cargando clientes:', resCli.reason);
        }
        if (resProp.status === 'fulfilled') {
          const listProp = (resProp.value.data?.data ?? resProp.value.data ?? []) as any[];
          setPropiedades((prev) => {
            const m = new Map(prev.map((p) => [p.id, p]));
            listProp.forEach((p) => m.set(p.id, { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null } as PropiedadLight));
            return Array.from(m.values());
          });
        } else {
          console.error('[VentasPage] Error cargando propiedades:', resProp.reason);
        }
        if (resRes.status === 'fulfilled') {
          const listRes = (resRes.value.data?.data ?? resRes.value.data ?? []) as any[];
          setReservas((prev) => {
            const m = new Map(prev.map((r) => [r.id, r]));
            listRes.forEach((r) => m.set(r.id, { id: r.id, estado: r.estado || 'PENDIENTE', fechaReserva: r.fechaReserva, fechaVencimiento: r.fechaVencimiento, montoSeparacion: r.montoSeparacion || '0', clienteId: r.clienteId, propiedadId: r.propiedadId, asesorId: r.asesorId, precioFinal: r.precioFinal || r.montoSeparacion || '0' } as any));
            return Array.from(m.values());
          });
        } else {
          console.error('[VentasPage] Error cargando reservas:', resRes.reason);
        }
        setAsesores((prev) => {
          const m = new Map(prev.map((a) => [a.id, a]));
          if (yoAsesor) m.set(yoAsesor.id, yoAsesor);
          return Array.from(m.values());
        });
      } catch (e) {
        console.error('[VentasPage] Excepción precargando listas:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, refsToken]);

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
    if (typeof window === 'undefined') return;
    if (!detailRef.current) return;
    const B = (window as any).bootstrap;
    if (!detailBsRef.current && B?.Modal) {
      detailBsRef.current = new B.Modal(detailRef.current, { backdrop: 'static', keyboard: false });
    }
    if (detailBsRef.current) {
      if (detailOpen) detailBsRef.current.show();
      else detailBsRef.current.hide();
    }
  }, [detailOpen]);

  const autoOpenTriggeredRef = useRef(false);
  useEffect(() => {
    if (!searchParams || autoOpenTriggeredRef.current) return;
    const reservaId = searchParams.get('reservaId');
    const clienteId = searchParams.get('clienteId');
    const propiedadId = searchParams.get('propiedadId');
    const asesorId = searchParams.get('asesorId');
    const from = searchParams.get('from');
    if (from !== 'reservas' || !reservaId) return;
    autoOpenTriggeredRef.current = true;
    (async () => {
      if (empresaId) {
        try {
          const faltaCliente = clienteId && !clientes.find((c) => c.id === clienteId);
          const faltaPropiedad = propiedadId && !propiedades.find((p) => p.id === propiedadId);
          const faltaReserva = reservaId && !reservas.find((r) => r.id === reservaId);
          if (faltaCliente || faltaPropiedad || faltaReserva) {
            await Promise.allSettled([
              faltaCliente ? http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }).then(({ data }) => {
                const list = (data?.data ?? data ?? []) as any[];
                setClientes((prev) => {
                  const m = new Map(prev.map((c) => [c.id, c]));
                  list.forEach((c) => m.set(c.id, { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, estado: c.estado || 'NUEVO' } as ClienteLight));
                  return Array.from(m.values());
                });
              }) : Promise.resolve(),
              faltaPropiedad ? http.get<any>(`/empresas/${empresaId}/propiedades`, { params: { page: 1, limit: 100 } }).then(({ data }) => {
                const list = (data?.data ?? data ?? []) as any[];
                setPropiedades((prev) => {
                  const m = new Map(prev.map((p) => [p.id, p]));
                  list.forEach((p) => m.set(p.id, { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null } as PropiedadLight));
                  return Array.from(m.values());
                });
              }) : Promise.resolve(),
              faltaReserva ? http.get<any>(`/empresas/${empresaId}/reservas`, { params: { page: 1, limit: 100 } }).then(({ data }) => {
                const list = (data?.data ?? data ?? []) as any[];
                setReservas((prev) => {
                  const m = new Map(prev.map((r) => [r.id, r]));
                  list.forEach((r) => m.set(r.id, { id: r.id, estado: r.estado || 'PENDIENTE', fechaReserva: r.fechaReserva, fechaVencimiento: r.fechaVencimiento, montoSeparacion: r.montoSeparacion || '0', clienteId: r.clienteId, propiedadId: r.propiedadId, asesorId: r.asesorId, precioFinal: r.precioFinal || r.montoSeparacion || '0' } as any));
                  return Array.from(m.values());
                });
              }) : Promise.resolve(),
            ]);
          }
          showToast('💰 Confirmando la venta desde la reserva… revisa los datos y pulsa [Crear venta].', 'ok');
        } catch (e) {
          console.error('[VentasPage] Error precargando refs para abrir con reserva:', e);
        }
      }
      setTimeout(() => {
        setEditTarget(null);
        setModalMode('create');
        setModalOpen(true);
      }, 150);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, empresaId, clientes, propiedades, reservas]);

  async function openDetail(id: string) {
    if (!empresaId) return;
    setDetail(null);
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const { data } = await http.get<Venta>(`/empresas/${empresaId}/ventas/${id}`);
      setDetail(data);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  }

  function onSaved(v: Venta) {
    setModalOpen(false);
    setEditTarget(null);
    if (v.cliente) setClientes((prev) => prev.find((c) => c.id === v.cliente.id) ? prev : [...prev, v.cliente]);
    if (v.asesor) setAsesores((prev) => prev.find((a) => a.id === v.asesor.id) ? prev : [...prev, v.asesor]);
    if (v.propiedad) setPropiedades((prev) => prev.find((p) => p.id === v.propiedad.id) ? prev : [...prev, v.propiedad]);
    if (v.reserva) setReservas((prev) => prev.find((r) => r.id === v.reserva.id) ? prev : [...prev, v.reserva]);
    fetchPage(filters);
  }

  function onRefAdd(kind: 'cliente' | 'asesor' | 'propiedad' | 'reserva', ref: any) {
    if (kind === 'cliente') setClientes((prev) => prev.find((c) => c.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'asesor') setAsesores((prev) => prev.find((a) => a.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'propiedad') setPropiedades((prev) => prev.find((p) => p.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'reserva') setReservas((prev) => prev.find((r) => r.id === ref.id) ? prev : [...prev, ref]);
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente esta venta?')) return;
    try {
      await http.delete(`/empresas/${empresaId}/ventas/${id}`);
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar la venta.');
    }
  }

  const meta = data?.meta;
  const pages = useMemo(() => buildPages(meta?.page ?? 1, meta?.totalPages ?? 1), [meta]);

  const stats = useMemo(() => {
    if (!data?.data) return { total: 0, monto: 0, pagadas: 0, pendientes: 0, saldo: 0 };
    let monto = 0, pagadas = 0, pendientes = 0, saldo = 0;
    data.data.forEach((v) => {
      monto += parseFloat(v.totalVenta || '0');
      saldo += parseFloat(v.saldoPendiente || '0');
      if (v.estado === 'PAGADA') pagadas++;
      else if (v.estado !== 'ANULADA') pendientes++;
    });
    return { total: meta?.total ?? 0, monto, pagadas, pendientes, saldo };
  }, [data, meta]);

  return (
    <AppLayout>
      {toast && (
        <div
          className={`position-fixed top-0 end-0 m-3 px-3 py-2 small rounded shadow-lg border z-3 ${toast.kind === 'ok' ? 'bg-success text-white border-success' : 'bg-danger text-white border-danger'}`}
          style={{ zIndex: 9999, transition: 'opacity 200ms' }}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Ventas</h1>
          <p className="page-subtitle">Gestiona las ventas cerradas de tu cartera inmobiliaria.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">
            Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0'}
          </div>
          <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handleRefreshRefs} title="Volver a cargar clientes/asesores/propiedades/reservas">
            <i className="bi bi-arrow-clockwise" /> Recargar listas
          </button>
          <button className="btn btn-sm btn-primary d-flex align-items-center gap-2" onClick={() => { handleRefreshRefs(); setEditTarget(null); setModalMode('create'); setModalOpen(true); }}>
            <i className="bi bi-plus-lg" /> Nueva venta
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-bag-check fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Total ventas</div>
                <div className="fw-bold fs-5">{stats.total}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-check2-circle fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Pagadas</div>
                <div className="fw-bold fs-5 text-success">{stats.pagadas}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-clock-history fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Pendientes</div>
                <div className="fw-bold fs-5 text-warning">{stats.pendientes}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: '#fce7f3', color: '#9d174d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-cash-stack fs-5" />
              </div>
              <div>
                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Monto total</div>
                <div className="fw-bold fs-5">{formatPEN(stats.monto)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small mb-4 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-4">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5>
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
              <select className="form-select" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoVenta) || '' }))}>
                <option value="">Todos</option>
                {ESTADOS_VENTA.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Método pago</label>
              <select className="form-select" value={filters.metodoPago} onChange={(e) => setFilters((f) => ({ ...f, page: 1, metodoPago: (e.target.value as MetodoPagoVenta) || '' }))}>
                <option value="">Todos</option>
                {METODOS_VENTA.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
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
                <option value="fechaVenta">Fecha venta</option>
                <option value="totalVenta">Total venta</option>
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
            <div className="col-6 col-md-4 col-lg-2 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', metodoPago: '', clienteId: '', propiedadId: '', reservaId: '', asesorId: '', sortBy: 'fechaVenta', sortDirection: 'desc' })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-list-ul me-2 text-primary" /> Listado de ventas</h5>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Propiedad</th>
                <th>Reserva</th>
                <th>Total</th>
                <th>Saldo</th>
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
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#eef2ff', color: '#3730a3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-bag-check fs-3" />
                  </div>
                  <div className="fw-semibold">No hay ventas que coincidan con los filtros</div>
                  <div className="text-muted small mb-2">Prueba limpiando los filtros o crea una nueva venta.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}><i className="bi bi-plus-lg me-1" /> Crear</button>
                </td></tr>
              )}
              {data?.data.map((v) => {
                const saldoPendiente = parseFloat(v.saldoPendiente || '0');
                return (
                  <tr key={v.id}>
                    <td>
                      <div className="fw-semibold small">{formatDate(v.fechaVenta)}</div>
                      <div className="text-muted small" style={{ fontSize: '.78rem' }}>Creada: {formatDateTime(v.createdAt)}</div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(v.cliente.nombres, v.cliente.apellidos)}</span>
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <div className="fw-semibold small lh-1">{v.cliente.nombres} {v.cliente.apellidos}</div>
                            <span className="badge text-bg-light border text-muted fw-normal px-1.5 py-0" style={{ fontFamily: 'monospace', fontSize: '.68rem', lineHeight: 1.3 }}>{v.clienteId.slice(0, 8)}…</span>
                          </div>
                          <div className="text-muted small" style={{ fontSize: '.78rem' }}>{v.cliente.celular || v.cliente.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-xs" style={{ background: '#dcfce7', color: '#166534' }}>{initials(v.asesor.nombres, v.asesor.apellidos)}</span>
                        <div>
                          <div className="fw-semibold small">{v.asesor.nombres} {v.asesor.apellidos}</div>
                          <div className="text-muted small" style={{ fontSize: '.78rem' }}>{v.asesor.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold small lh-1">{v.propiedad.nombre}</div>
                      <div className="text-muted small" style={{ fontSize: '.78rem' }}><i className="bi bi-upc me-1" />{v.propiedad.codigoInterno}{v.propiedad.proyecto?.nombre ? ` · ${v.propiedad.proyecto.nombre}` : ''}</div>
                    </td>
                    <td>
                      <div className="fw-semibold small" style={{ fontSize: '.82rem' }}>{v.reserva.id.slice(0, 10)}…</div>
                      <div className="text-muted small" style={{ fontSize: '.78rem' }}>Sep.: {formatPEN(v.reserva.montoSeparacion)}</div>
                    </td>
                    <td>
                      <div className="fw-bold text-primary">{formatPEN(v.totalVenta)}</div>
                      <div className="text-muted small" style={{ fontSize: '.75rem' }}>Método: {v.metodoPago.replace(/_/g, ' ')}</div>
                    </td>
                    <td>
                      <div className={`fw-bold ${saldoPendiente > 0 ? (v.estado === 'ANULADA' ? 'text-secondary' : 'text-danger') : 'text-success'}`}>
                        {v.estado === 'ANULADA' ? '—' : formatPEN(saldoPendiente)}
                      </div>
                      {v.estado !== 'ANULADA' && saldoPendiente > 0 && <div className="text-muted small" style={{ fontSize: '.72rem' }}>Pendiente</div>}
                    </td>
                    <td>
                      <span className={`badge ${VENTA_BADGE[v.estado]} fw-semibold`}>{v.estado.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          title="Copiar ID de la venta"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              navigator.clipboard.writeText(v.id);
                              showToast('✅ ID de venta copiado');
                            } catch {
                              showToast('❌ No se pudo copiar', 'err');
                            }
                          }}
                        >
                          <i className="bi bi-clipboard" />
                        </button>
                        <button className="btn btn-sm btn-outline-info" title="Detalle" onClick={() => openDetail(v.id)}><i className="bi bi-eye" /></button>
                        <button className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => { setEditTarget(v); setModalMode('edit'); setModalOpen(true); }}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => eliminar(v.id)}><i className="bi bi-trash3" /></button>
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

      <VentaModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        clientes={clientes}
        asesores={asesores}
        propiedades={propiedades}
        reservas={reservas}
        onRefAdd={onRefAdd}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <div className="modal fade" id="ventaDetailModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={detailRef}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5 fw-bold">
                <i className="bi bi-receipt me-2 text-info" />Detalle de venta
              </h1>
              <button type="button" className="btn-close" disabled={detailLoading} onClick={() => setDetailOpen(false)} aria-label="Close" />
            </div>
            <div className="modal-body">
              {detailLoading && !detail && (
                <div className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando detalle...</div>
              )}
              {!detailLoading && detail && (
                <div className="row g-4">
                  <div className="col-md-6">
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Cliente</h6>
                    <div className="d-flex align-items-center gap-3 mb-3 p-3 rounded border">
                      <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(detail.cliente.nombres, detail.cliente.apellidos)}</span>
                      <div>
                        <div className="fw-semibold">{detail.cliente.nombres} {detail.cliente.apellidos}</div>
                        <div className="text-muted small">{detail.cliente.correo || '—'}</div>
                        <div className="text-muted small">{detail.cliente.celular || '—'}</div>
                      </div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Asesor</h6>
                    <div className="d-flex align-items-center gap-3 mb-3 p-3 rounded border">
                      <span className="avatar-xs" style={{ background: '#dcfce7', color: '#166534' }}>{initials(detail.asesor.nombres, detail.asesor.apellidos)}</span>
                      <div>
                        <div className="fw-semibold">{detail.asesor.nombres} {detail.asesor.apellidos}</div>
                        <div className="text-muted small">{detail.asesor.correo || '—'}</div>
                      </div>
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
                      <div className="col-6">
                        <label className="form-label small fw-semibold text-muted">Fecha de venta</label>
                        <div className="fw-semibold">{formatDateTime(detail.fechaVenta)}</div>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold text-muted">Estado</label>
                        <div><span className={`badge ${VENTA_BADGE[detail.estado]} fw-semibold`}>{detail.estado.replace(/_/g, ' ')}</span></div>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold text-muted">Método de pago</label>
                        <div className="fw-semibold">{detail.metodoPago.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold text-muted">Reserva</label>
                        <div className="fw-mono small" style={{ fontFamily: 'monospace' }}>{detail.reservaId}</div>
                      </div>
                    </div>
                    <div className="card border-0 bg-light mb-3">
                      <div className="card-body p-3">
                        <h6 className="fw-semibold small text-uppercase text-muted mb-2">Montos</h6>
                        <div className="d-flex justify-content-between mb-1"><span className="text-muted small">Precio final</span><span className="fw-semibold">{formatPEN(detail.precioFinal)}</span></div>
                        <div className="d-flex justify-content-between mb-1"><span className="text-muted small">Descuento</span><span className="fw-semibold text-danger">- {formatPEN(detail.descuento)}</span></div>
                        <div className="d-flex justify-content-between mb-1"><span className="text-muted small">Impuestos</span><span className="fw-semibold">{formatPEN(detail.impuestos || '0')}</span></div>
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between mb-1"><span className="fw-semibold">Total venta</span><span className="fw-bold text-primary fs-5">{formatPEN(detail.totalVenta)}</span></div>
                        <div className="d-flex justify-content-between"><span className="fw-semibold">Saldo pendiente</span><span className={`fw-bold ${parseFloat(detail.saldoPendiente || '0') > 0 ? 'text-danger' : 'text-success'}`}>{detail.estado === 'ANULADA' ? '—' : formatPEN(detail.saldoPendiente)}</span></div>
                      </div>
                    </div>
                    <h6 className="fw-semibold small text-uppercase text-muted mb-2">Observaciones</h6>
                    <div className="p-3 rounded border bg-white min-h-6" style={{ minHeight: 72 }}>{detail.observaciones || <span className="text-muted">Sin observaciones.</span>}</div>
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
