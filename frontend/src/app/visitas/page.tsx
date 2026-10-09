'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import VisitaModal from '@/components/VisitaModal';
import { formatDate, formatDateTime, getSession, http, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  ESTADOS_VISITA,
  EstadoVisita,
  FindVisitasQuery,
  Paginated,
  PropiedadLight,
  VISITA_BADGE,
  Visita,
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

export default function VisitasPage() {
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
  const [refsToken, setRefsToken] = useState(0);
  const handleRefreshRefs = () => setRefsToken((n) => n + 1);

  const [filters, setFilters] = useState<FindVisitasQuery>({
    page: 1, limit: 10, search: '', estado: '', clienteId: '',
    propiedadId: '', asesorId: '', sortBy: 'fechaHora', sortDirection: 'desc',
  });

  const [data, setData] = useState<Paginated<Visita> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [asesores, setAsesores] = useState<AsesorLight[]>(yoAsesor ? [yoAsesor] : []);
  const [propiedades, setPropiedades] = useState<PropiedadLight[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Visita | null>(null);

  const debRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindVisitasQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as (keyof FindVisitasQuery)[]).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null) return;
        params[k] = v;
      });
      const { data: res } = await http.get<Paginated<Visita>>(`/empresas/${empresaId}/visitas`, { params });
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
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar las visitas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.estado, filters.clienteId, filters.propiedadId, filters.asesorId, filters.sortBy, filters.sortDirection]);

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
        } else {
          console.error('[VisitasPage] Error cargando clientes:', resCli.reason);
        }
        if (resProp.status === 'fulfilled') {
          const listProp = (resProp.value.data?.data ?? resProp.value.data ?? []) as any[];
          setPropiedades((prev) => {
            const m = new Map(prev.map((p) => [p.id, p]));
            listProp.forEach((p) => m.set(p.id, { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null } as PropiedadLight));
            return Array.from(m.values());
          });
        } else {
          console.error('[VisitasPage] Error cargando propiedades:', resProp.reason);
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
          } else {
            console.error('[VisitasPage] Error cargando usuarios/asesores:', resUsr.reason);
          }
          return Array.from(m.values());
        });
      } catch (e) {
        console.error('[VisitasPage] Excepción precargando listas:', e);
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

  function onSaved(v: Visita) {
    setModalOpen(false);
    setEditTarget(null);
    if (v.cliente) setClientes((prev) => prev.find((c) => c.id === v.cliente.id) ? prev : [...prev, v.cliente]);
    if (v.asesor) setAsesores((prev) => prev.find((a) => a.id === v.asesor.id) ? prev : [...prev, v.asesor]);
    if (v.propiedad) setPropiedades((prev) => prev.find((p) => p.id === v.propiedad.id) ? prev : [...prev, v.propiedad]);
    fetchPage(filters);
  }

  function onRefAdd(kind: 'cliente' | 'asesor' | 'propiedad', ref: any) {
    if (kind === 'cliente') setClientes((prev) => prev.find((c) => c.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'asesor') setAsesores((prev) => prev.find((a) => a.id === ref.id) ? prev : [...prev, ref]);
    if (kind === 'propiedad') setPropiedades((prev) => prev.find((p) => p.id === ref.id) ? prev : [...prev, ref]);
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente esta visita?')) return;
    try {
      await http.delete(`/empresas/${empresaId}/visitas/${id}`);
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar la visita.');
    }
  }

  const meta = data?.meta;
  const pages = useMemo(() => buildPages(meta?.page ?? 1, meta?.totalPages ?? 1), [meta]);

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Visitas</h1>
          <p className="page-subtitle">Gestiona las visitas programadas de tu cartera de clientes.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">
            Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0'}
          </div>
          <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handleRefreshRefs} title="Volver a cargar clientes/asesores/propiedades">
            <i className="bi bi-arrow-clockwise" /> Recargar listas
          </button>
          <button className="btn btn-sm btn-primary d-flex align-items-center gap-2" onClick={() => { handleRefreshRefs(); setEditTarget(null); setModalMode('create'); setModalOpen(true); }}>
            <i className="bi bi-plus-lg" /> Nueva visita
          </button>
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
                <input ref={searchRef} defaultValue={filters.search} className="form-control" placeholder="Cliente, propiedad, asesor, lugar, resultado..." />
              </div>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Estado</label>
              <select className="form-select" value={filters.estado} onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoVisita) || '' }))}>
                <option value="">Todos</option>
                {ESTADOS_VISITA.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
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
                <option value="fechaHora">Fecha/hora</option>
                <option value="createdAt">Creada</option>
                <option value="updatedAt">Actualizada</option>
                <option value="estado">Estado</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Mostrar</label>
              <select className="form-select" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', clienteId: '', propiedadId: '', asesorId: '', sortBy: 'fechaHora', sortDirection: 'desc' })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-list-ul me-2 text-primary" /> Listado de visitas</h5>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Propiedad</th>
                <th>Lugar</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data?.data.length && (
                <tr><td colSpan={7} className="text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando...</td></tr>
              )}
              {!loading && !data?.data.length && (
                <tr><td colSpan={7} className="text-center py-5">
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#eef2ff', color: '#3730a3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-calendar-check fs-3" />
                  </div>
                  <div className="fw-semibold">No hay visitas que coincidan con los filtros</div>
                  <div className="text-muted small mb-2">Prueba limpiando los filtros o crea una nueva visita.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}><i className="bi bi-plus-lg me-1" /> Crear</button>
                </td></tr>
              )}
              {data?.data.map((v) => {
                const past = new Date(v.fechaHora).getTime() < Date.now() && v.estado === 'PROGRAMADA';
                return (
                  <tr key={v.id}>
                    <td>
                      <div className="fw-semibold small">{formatDateTime(v.fechaHora)}</div>
                      {v.duracionEstimada != null && <div className="text-muted small" style={{ fontSize: '.78rem' }}>Duración: {v.duracionEstimada} min</div>}
                      {past && <span className="badge badge-soft-warning mt-1" style={{ fontSize: '.65rem' }}><i className="bi bi-clock-history me-1" />Pendiente</span>}
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="avatar-sm" style={{ background: '#eef2ff', color: '#3730a3' }}>{initials(v.cliente.nombres, v.cliente.apellidos)}</span>
                        <div>
                          <div className="fw-semibold small lh-1">{v.cliente.nombres} {v.cliente.apellidos}</div>
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
                      <div className="small">
                        {v.lugarEncuentro ? <><i className="bi bi-geo-alt me-1" />{v.lugarEncuentro}</> : <span className="text-muted">—</span>}
                      </div>
                      {v.resultado && <div className="text-muted small" style={{ fontSize: '.78rem' }}>Resultado: {v.resultado}</div>}
                    </td>
                    <td>
                      <span className={`badge ${VISITA_BADGE[v.estado]} fw-semibold`}>{v.estado.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
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

      <VisitaModal
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
