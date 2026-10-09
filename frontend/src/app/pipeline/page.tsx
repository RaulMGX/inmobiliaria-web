'use client';

import './pipeline.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import PipelineModal from '@/components/PipelineModal';
import { formatDate, getSession, http, humanizeToken, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  ETAPAS_PIPELINE,
  ETAPA_BADGE,
  ETAPA_COLOR,
  EtapaPipeline,
  FindPipelineQuery,
  Paginated,
  PipelineOportunidad,
  PRIORIDAD_COLOR,
  PRIORIDADES_PIPELINE,
  PrioridadPipeline,
} from '@/lib/pipeline';

export default function PipelinePage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindPipelineQuery>({
    page: 1,
    limit: 50,
    search: '',
    etapa: '',
    prioridad: '',
    clienteId: '',
    asesorId: '',
    vencidas: '',
    sortBy: 'proximaFechaSeguimiento',
    sortDirection: 'asc',
  });

  const [list, setList] = useState<PipelineOportunidad[]>([]);
  const [meta, setMeta] = useState<{ page: number; total: number; totalPages: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const yoAsesor: AsesorLight | null = sess?.usuario
    ? {
        id: sess.usuario.id,
        nombres: sess.usuario.nombres || '',
        apellidos: sess.usuario.apellidos || '',
        correo: sess.usuario.correo || null,
      }
    : null;
  const [clientes, setClientes] = useState<ClienteLight[]>([]);
  const [asesores, setAsesores] = useState<AsesorLight[]>(yoAsesor ? [yoAsesor] : []);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<PipelineOportunidad | null>(null);

  const [moving, setMoving] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<EtapaPipeline | null>(null);
  const [collapsedEtapas, setCollapsedEtapas] = useState<Partial<Record<EtapaPipeline, boolean>>>({});
  const [viewCompact, setViewCompact] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement | null>(null);

  function toggleCollapse(e: EtapaPipeline) {
    setCollapsedEtapas((prev) => ({ ...prev, [e]: !prev[e] }));
  }

  const fetchPage = useCallback(async (q: FindPipelineQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as Array<keyof FindPipelineQuery>).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null || v === undefined) return;
        params[k] = v;
      });
      const { data } = await http.get<Paginated<PipelineOportunidad>>(`/empresas/${empresaId}/pipeline`, { params });
      setList(data.data);
      setMeta(data.meta);
      setClientes((prev) => {
        const m = new Map(prev.map((c) => [c.id, c]));
        data.data.forEach((p) => { if (p.cliente) m.set(p.cliente.id, p.cliente); });
        return Array.from(m.values());
      });
      setAsesores((prev) => {
        const m = new Map(prev.map((a) => [a.id, a]));
        data.data.forEach((p) => { if (p.asesor) m.set(p.asesor.id, p.asesor); });
        return Array.from(m.values());
      });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar el pipeline comercial.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      try {
        const [resCli, resUsr] = await Promise.allSettled([
          http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }),
          http.get<any>(`/empresas/${empresaId}/usuarios`, { params: { page: 1, limit: 100 } }),
        ]);
        if (resCli.status === 'fulfilled') {
          const listCli = (resCli.value.data?.data ?? resCli.value.data ?? []) as any[];
          setClientes((prev) => {
            const m = new Map(prev.map((c) => [c.id, c]));
            listCli.forEach((c: any) => m.set(c.id, { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, estado: c.estado || 'NUEVO' } as ClienteLight));
            return Array.from(m.values());
          });
        }
        setAsesores((prev) => {
          const m = new Map(prev.map((a) => [a.id, a]));
          if (yoAsesor) m.set(yoAsesor.id, yoAsesor);
          if (resUsr.status === 'fulfilled') {
            const listUsr = (resUsr.value.data?.data ?? resUsr.value.data ?? []) as any[];
            listUsr.forEach((u: any) => {
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
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.etapa, filters.prioridad, filters.clienteId, filters.asesorId, filters.vencidas, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    if (!searchRef.current) return;
    const el = searchRef.current;
    const h = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const q = { ...filters, page: 1, search: el.value };
        setFilters(q);
        fetchPage(q);
      }, 350);
    };
    el.addEventListener('input', h);
    return () => el.removeEventListener('input', h);
  }, [fetchPage, filters]);

  function onSaved(p: PipelineOportunidad, _mode: 'create' | 'edit') {
    setModalOpen(false);
    setEditTarget(null);
    if (p.cliente) setClientes((prev) => prev.find((c) => c.id === p.cliente.id) ? prev : [...prev, p.cliente]);
    if (p.asesor) setAsesores((prev) => prev.find((a) => a.id === p.asesor.id) ? prev : [...prev, p.asesor]);
    fetchPage(filters);
  }

  function onNewRef(kind: 'cliente' | 'asesor', ref: any) {
    if (kind === 'cliente') {
      setClientes((prev) => {
        if (prev.find((c) => c.id === ref.id)) return prev;
        return [...prev, { id: ref.id, nombres: ref.nombres, apellidos: ref.apellidos, correo: ref.correo || null, celular: ref.celular || null, estado: 'NUEVO' } as ClienteLight];
      });
    } else {
      setAsesores((prev) => {
        if (prev.find((a) => a.id === ref.id)) return prev;
        return [...prev, { id: ref.id, nombres: ref.nombres, apellidos: ref.apellidos, correo: ref.correo || null } as AsesorLight];
      });
    }
  }

  async function moveEtapa(id: string, etapa: EtapaPipeline) {
    if (!empresaId) return;
    setMoving(id);
    try {
      const { data } = await http.patch<PipelineOportunidad>(`/empresas/${empresaId}/pipeline/${id}`, { etapa });
      setList((prev) => prev.map((x) => (x.id === id ? data : x)));
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo mover la oportunidad.');
    } finally {
      setMoving(null);
    }
  }

  async function eliminar(id: string) {
    if (!empresaId) return;
    if (!confirm('¿Eliminar lógicamente esta oportunidad?')) return;
    try {
      await http.delete(`/empresas/${empresaId}/pipeline/${id}`);
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar la oportunidad.');
    }
  }

  const grouped = useMemo(() => {
    const g: Record<EtapaPipeline, PipelineOportunidad[]> = Object.fromEntries(
      ETAPAS_PIPELINE.map((e) => [e, [] as PipelineOportunidad[]]),
    ) as any;
    list.forEach((p) => { if (g[p.etapa]) g[p.etapa].push(p); });
    return g;
  }, [list]);

  const totalOport = list.length;
  const totalMontoEstimado = list.reduce((acc, p) => acc + (Number(p.probabilidadCierre || 0) * (1 + p.id.length % 3)), 0);

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Pipeline Comercial</h1>
          <p className="page-subtitle">
            Vista Kanban del proceso comercial por etapas. Arrastra tarjetas entre columnas para cambiar de etapa.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="text-muted small">
            Total oportunidades: <strong>{meta?.total ?? totalOport}</strong> · Página {meta?.page ?? 1}/{meta?.totalPages ?? 1}
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Vista">
            <button
              type="button"
              className={`btn ${!viewCompact ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewCompact(false)}
              title="Vista detallada"
            >
              <i className="bi bi-card-list me-1" /> Detallada
            </button>
            <button
              type="button"
              className={`btn ${viewCompact ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewCompact(true)}
              title="Vista compacta"
            >
              <i className="bi bi-grid-3x2-gap me-1" /> Compacta
            </button>
          </div>
          <button
            className="btn btn-sm btn-primary d-flex align-items-center gap-2"
            onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}
          >
            <i className="bi bi-plus-lg" /> Nueva oportunidad
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2 small mb-4 py-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>{error}</div>
        </div>
      )}

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
                <input
                  ref={searchRef}
                  defaultValue={filters.search}
                  className="form-control"
                  placeholder="Cliente, asesor, documento, observaciones..."
                />
              </div>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Etapa</label>
              <select
                className="form-select"
                value={filters.etapa}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, etapa: (e.target.value as EtapaPipeline) || '' }))}
              >
                <option value="">Todas</option>
                {ETAPAS_PIPELINE.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Prioridad</label>
              <select
                className="form-select"
                value={filters.prioridad}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, prioridad: (e.target.value as PrioridadPipeline) || '' }))}
              >
                <option value="">Todas</option>
                {PRIORIDADES_PIPELINE.map((p) => <option key={p} value={p}>{humanizeToken(p)}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Cliente</label>
              <select
                className="form-select"
                value={filters.clienteId}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, clienteId: e.target.value }))}
              >
                <option value="">Todos</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Asesor</label>
              <select
                className="form-select"
                value={filters.asesorId}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, asesorId: e.target.value }))}
              >
                <option value="">Todos</option>
                {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Vencidas</label>
              <select
                className="form-select"
                value={String(filters.vencidas || '')}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, vencidas: e.target.value === '' ? '' : e.target.value === 'true' } as any))}
              >
                <option value="">Todas</option>
                <option value="true">Solo vencidas</option>
                <option value="false">Solo no vencidas</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Ordenar por</label>
              <select
                className="form-select"
                value={filters.sortBy}
                onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as any }))}
              >
                <option value="createdAt">Creado</option>
                <option value="updatedAt">Actualizado</option>
                <option value="fechaIngreso">Ingreso</option>
                <option value="proximaFechaSeguimiento">Próx. seguimiento</option>
                <option value="probabilidadCierre">Probabilidad</option>
                <option value="etapa">Etapa</option>
                <option value="prioridad">Prioridad</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Mostrar</label>
              <select
                className="form-select"
                value={filters.limit}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}
              >
                {[20, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilters({
                  page: 1, limit: 50, search: '', etapa: '', prioridad: '',
                  clienteId: '', asesorId: '', vencidas: '',
                  sortBy: 'proximaFechaSeguimiento', sortDirection: 'asc',
                })}
              >
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
          {(meta?.totalPages ?? 1) > 1 && (
            <nav aria-label="Paginación pipeline" className="mt-3 d-flex align-items-center justify-content-end gap-2">
              <span className="text-muted small">Página {meta?.page} / {meta?.totalPages} · {meta?.total} oportunidades</span>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${(meta?.page ?? 1) === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (meta?.page ?? 1) - 1) }))} disabled={(meta?.page ?? 1) === 1}>
                    <i className="bi bi-chevron-left" />
                  </button>
                </li>
                <li className={`page-item ${(meta?.page ?? 1) === (meta?.totalPages ?? 1) ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: Math.min(meta?.totalPages ?? 1, (meta?.page ?? 1) + 1) }))} disabled={(meta?.page ?? 1) === (meta?.totalPages ?? 1)}>
                    <i className="bi bi-chevron-right" />
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border me-2" aria-hidden="true" /> Cargando pipeline...
        </div>
      )}

      {!loading && list.length === 0 ? (
        <div className="section-card">
          <div className="card-body text-center py-5">
            <div className="mx-auto mb-3" style={{ width: 60, height: 60, borderRadius: 16, background: '#eef2ff', color: '#3730a3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-diagram-3 fs-3" />
            </div>
            <div className="fw-semibold mb-1">No hay oportunidades que coincidan con los filtros</div>
            <div className="text-muted small mb-3">Prueba limpiando los filtros o crea una nueva oportunidad.</div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}
            >
              <i className="bi bi-plus-lg me-1" /> Crear primera oportunidad
            </button>
          </div>
        </div>
      ) : (
        <div className={`pipeline-board ${viewCompact ? 'is-compact' : ''}`} onDragLeave={() => setDragOverEtapa(null)}>
          {ETAPAS_PIPELINE.map((etapa) => {
            const items = grouped[etapa] || [];
            const prob = items.reduce((a, b) => a + (Number(b.probabilidadCierre || 0)), 0);
            const collapsed = !!collapsedEtapas[etapa];
            return (
              <div
                key={etapa}
                className={`pipeline-col ${dragOverEtapa === etapa ? 'drag-over' : ''} ${collapsed ? 'col-collapsed' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverEtapa(etapa); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  setDragOverEtapa(null);
                  if (id) moveEtapa(id, etapa);
                }}
              >
                <div className="pipeline-col-head">
                  <button type="button" className="pipeline-col-title" onClick={() => toggleCollapse(etapa)} title={collapsed ? 'Expandir columna' : 'Colapsar columna'}>
                    <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-down'} pipeline-col-chevron`} />
                    <span className="pipeline-col-dot" style={{ background: ETAPA_COLOR[etapa] }} />
                    <span className="pipeline-col-name">{etapa.replace(/_/g, ' ')}</span>
                    <span className={`badge ${ETAPA_BADGE[etapa]}`} style={{ fontSize: '.65rem' }}>
                      {items.length}
                    </span>
                  </button>
                  {!collapsed && (
                    <span className="pipeline-col-prob" title="Σ Probabilidad cierre">
                      <strong>{prob}</strong>
                      <span>pts</span>
                    </span>
                  )}
                </div>

                {!collapsed && items.length === 0 && (
                  <div className="pipeline-empty">
                    <i className="bi bi-inbox" />
                    <div>Sin oportunidades</div>
                    <div className="opacity-75" style={{ fontSize: '.75rem' }}>Arrastra aquí</div>
                  </div>
                )}

                {!collapsed && (
                  <div className="pipeline-col-body">
                    {items.map((p) => (
                      <KanbanCard
                        key={p.id}
                        p={p}
                        moving={moving === p.id}
                        compact={viewCompact}
                        onStart={(id) => setMoving(id)}
                        onEnd={() => setMoving(null)}
                        onEdit={() => { setEditTarget(p); setModalMode('edit'); setModalOpen(true); }}
                        onDelete={() => eliminar(p.id)}
                        onMoveEtapa={(et) => moveEtapa(p.id, et)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PipelineModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        clientes={clientes}
        asesores={asesores}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
        onNewRef={onNewRef}
      />
    </AppLayout>
  );
}

function KanbanCard({
  p,
  moving,
  compact,
  onStart,
  onEnd,
  onEdit,
  onDelete,
  onMoveEtapa,
}: {
  p: PipelineOportunidad;
  moving: boolean;
  compact: boolean;
  onStart: (id: string) => void;
  onEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveEtapa: (e: EtapaPipeline) => void;
}) {
  const vencida = p.proximaFechaSeguimiento ? new Date(p.proximaFechaSeguimiento).getTime() < Date.now() : false;

  return (
    <div
      className={`kanban-card ${moving ? 'dragging' : ''} ${compact ? 'k-compact' : ''}`}
      draggable={!moving}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', p.id);
        onStart(p.id);
      }}
      onDragEnd={onEnd}
    >
      {compact ? (
        <>
          <div className="k-compact-row1">
            <span className="badge" style={{ background: PRIORIDAD_COLOR[p.prioridad] + '22', color: PRIORIDAD_COLOR[p.prioridad], fontSize: '.65rem' }}>
              {humanizeToken(p.prioridad)}
            </span>
            {vencida && <span className="badge badge-soft-danger" style={{ fontSize: '.65rem' }}>Vencida</span>}
            <div className="dropdown ms-auto">
              <button className="btn btn-white btn-sm shadow-none px-2 py-0 border-0 text-muted" data-bs-toggle="dropdown" aria-expanded="false">
                <i className="bi bi-three-dots-vertical" />
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm mt-1">
                <li><button className="dropdown-item" onClick={onEdit}><i className="bi bi-pencil me-2" /> Editar</button></li>
                <li>
                  <div className="dropdown dropend" style={{ position: 'static' }}>
                    <button className="dropdown-item d-flex align-items-center justify-content-between" data-bs-toggle="dropdown">
                      <span><i className="bi bi-arrow-left-right me-2" /> Mover a etapa</span>
                      <i className="bi bi-chevron-right opacity-50" />
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      {ETAPAS_PIPELINE.map((e) => (
                        <li key={e}>
                          <button
                            className={`dropdown-item ${e === p.etapa ? 'active' : ''}`}
                            onClick={() => onMoveEtapa(e)}
                            disabled={moving}
                          >
                            <span className="d-inline-block me-2" style={{ width: 10, height: 10, borderRadius: 999, background: ETAPA_COLOR[e] }} />
                            {e.replace(/_/g, ' ')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item text-danger" onClick={onDelete} disabled={moving}>
                    <i className="bi bi-trash3 me-2" /> Eliminar
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="k-compact-title" onClick={onEdit} title={`${p.cliente?.nombres ?? ''} ${p.cliente?.apellidos ?? ''} · ${p.observaciones ?? ''}`}>
            {p.cliente?.nombres} {p.cliente?.apellidos}
          </div>
          <div className="k-compact-row2">
            <span className="avatar-xs" style={{ background: '#eef2ff', color: '#3730a3' }}>
              {initials(p.asesor?.nombres || '?', p.asesor?.apellidos || null)}
            </span>
            <span className="text-muted small truncate" title={p.asesor?.correo || ''}>
              {p.asesor?.nombres}
            </span>
            <div className="ms-auto d-flex align-items-center gap-2">
              <div className="k-prob k-prob-sm" title={`Probabilidad ${p.probabilidadCierre}%`}>
                <div style={{ width: `${p.probabilidadCierre || 0}%` }} />
              </div>
              <span className="small fw-semibold">{p.probabilidadCierre}%</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="k-top">
            <div className="flex-1">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="badge badge-soft-secondary" style={{ fontSize: '.7rem' }}>
                  <i className="bi bi-upc me-1" />{p.id.slice(0, 8)}
                </span>
                <span className="badge" style={{ background: PRIORIDAD_COLOR[p.prioridad] + '22', color: PRIORIDAD_COLOR[p.prioridad], fontSize: '.7rem' }}>
                  <i className="bi bi-flag me-1" />{humanizeToken(p.prioridad)}
                </span>
                {vencida && (
                  <span className="badge badge-soft-danger" style={{ fontSize: '.7rem' }}>
                    <i className="bi bi-clock-history me-1" />Vencida
                  </span>
                )}
              </div>
              <div className="k-title mt-2">
                {p.cliente?.nombres} {p.cliente?.apellidos}
              </div>
              <div className="k-sub">
                Ingreso: {formatDate(p.fechaIngreso)}
              </div>
            </div>
            <div className="d-flex flex-column align-items-end gap-1">
              <div className="dropdown">
                <button className="btn btn-white btn-sm shadow-none px-2 py-1 border-0" data-bs-toggle="dropdown" aria-expanded="false">
                  <i className="bi bi-three-dots-vertical" />
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow-sm mt-1">
                  <li><button className="dropdown-item" onClick={onEdit}><i className="bi bi-pencil me-2" /> Editar</button></li>
                  <li>
                    <div className="dropdown dropend" style={{ position: 'static' }}>
                      <button className="dropdown-item d-flex align-items-center justify-content-between" data-bs-toggle="dropdown">
                        <span><i className="bi bi-arrow-left-right me-2" /> Mover a etapa</span>
                        <i className="bi bi-chevron-right opacity-50" />
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        {ETAPAS_PIPELINE.map((e) => (
                          <li key={e}>
                            <button
                              className={`dropdown-item ${e === p.etapa ? 'active' : ''}`}
                              onClick={() => onMoveEtapa(e)}
                              disabled={moving}
                            >
                              <span className="d-inline-block me-2" style={{ width: 10, height: 10, borderRadius: 999, background: ETAPA_COLOR[e] }} />
                              {e.replace(/_/g, ' ')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item text-danger" onClick={onDelete} disabled={moving}>
                      <i className="bi bi-trash3 me-2" /> Eliminar
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="k-body">
            <div className="d-flex align-items-center gap-2">
              <span className="avatar-xs" style={{ background: '#eef2ff', color: '#3730a3' }}>
                {initials(p.asesor?.nombres || '?', p.asesor?.apellidos || null)}
              </span>
              <div style={{ fontSize: '.8rem' }}>
                <div className="fw-semibold">{p.asesor?.nombres} {p.asesor?.apellidos}</div>
                <div className="text-muted small" style={{ fontSize: '.75rem' }}>{p.asesor?.correo}</div>
              </div>
            </div>
            {p.cliente?.celular && (
              <div className="d-flex align-items-center gap-1 text-muted">
                <i className="bi bi-telephone" /><span>{p.cliente?.celular}</span>
                {p.cliente?.correo && <><i className="bi bi-dot" /><i className="bi bi-envelope" /><span>{p.cliente?.correo}</span></>}
              </div>
            )}
            {p.observaciones && (
              <div className="small text-muted d-flex align-items-start gap-1 border-start ps-2" style={{ borderColor: '#e5e7eb' }}>
                <i className="bi bi-chat-left-text mt-1" />
                <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.observaciones}</span>
              </div>
            )}
          </div>

          <div className="k-prob" title={`Probabilidad ${p.probabilidadCierre}%`}>
            <div style={{ width: `${p.probabilidadCierre || 0}%` }} />
          </div>
          <div className="d-flex align-items-center justify-content-between small text-muted">
            <span>Prob. cierre <strong className="text-dark">{p.probabilidadCierre}%</strong></span>
            <span>
              <i className="bi bi-calendar-event me-1" />
              {p.proximaFechaSeguimiento ? formatDate(p.proximaFechaSeguimiento) : 'Sin próximo'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
