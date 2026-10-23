'use client';

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import PropiedadModal from '@/components/PropiedadModal';
import { useBindBootstrapModal } from '@/lib/bootstrap-modal';
import { formatDate, formatPEN, getSession, http, humanizeToken } from '@/lib/api';
import {
  ESTADO_BADGE,
  ESTADOS_PROPIEDAD,
  EstadoPropiedad,
  FindPropiedadesQuery,
  Paginated,
  Propiedad,
  ProyectoLight,
  TIPO_ICON,
  TIPOS_PROPIEDAD,
  TipoPropiedad,
} from '@/lib/propiedades';

export default function PropiedadesPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState<FindPropiedadesQuery>({
    page: 1,
    limit: 10,
    search: '',
    estado: '',
    tipoPropiedad: '',
    proyectoId: '',
    disponible: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  const [result, setResult] = useState<Paginated<Propiedad> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirm, setConfirm] = useState<{ show: boolean; id: string | null; msg: string; working: boolean }>({
    show: false, id: null, msg: '', working: false,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Propiedad | null>(null);

  const [proyectos, setProyectos] = useState<ProyectoLight[]>([]);

  const debounceRef = useRef<number | undefined>(undefined);
  const searchInput = useRef<HTMLInputElement | null>(null);

  const fetchPage = useCallback(async (q: FindPropiedadesQuery) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      (Object.keys(q) as Array<keyof FindPropiedadesQuery>).forEach((k) => {
        const v = q[k];
        if (v === '' || v == null || v === undefined) return;
        params[k] = v;
      });
      const { data } = await http.get<Paginated<Propiedad>>(`/empresas/${empresaId}/propiedades`, { params });
      setResult(data);
      setProyectos((prev) => {
        const m = new Map(prev.map((p) => [p.id, p]));
        data.data.forEach((p) => {
          if (p.proyecto?.id) m.set(p.proyecto.id, p.proyecto);
        });
        return Array.from(m.values());
      });
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar el listado de propiedades.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPage(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.estado, filters.tipoPropiedad, filters.proyectoId, filters.disponible, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    if (!searchInput.current) return;
    const el = searchInput.current;
    const h = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        setFilters((f) => ({ ...f, page: 1, search: el.value }));
        fetchPage({ ...filters, page: 1, search: el.value });
      }, 350);
    };
    el.addEventListener('input', h);
    return () => el.removeEventListener('input', h);
  }, [fetchPage, filters]);

  function onSaved(p: Propiedad, mode: 'create' | 'edit') {
    setModalOpen(false);
    setEditTarget(null);
    fetchPage(filters);
    setProyectos((prev) => {
      if (!p.proyecto?.id) return prev;
      if (prev.find((x) => x.id === p.proyecto.id)) return prev;
      return [...prev, p.proyecto];
    });
  }

  async function doDelete() {
    if (!confirm.id || !empresaId) return;
    setConfirm((c) => ({ ...c, working: true }));
    try {
      await http.delete(`/empresas/${empresaId}/propiedades/${confirm.id}`);
      setConfirm({ show: false, id: null, msg: '', working: false });
      fetchPage(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo eliminar la propiedad.');
      setConfirm((c) => ({ ...c, working: false }));
    }
  }

  const pages = useMemo(() => buildPagination(result?.meta.page || 1, result?.meta.totalPages || 1), [result]);
  const meta = result?.meta;

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Propiedades</h1>
          <p className="page-subtitle">Gestiona el inventario de propiedades por empresa.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-download me-1" /> Exportar
          </button>
          <button
            className="btn btn-sm btn-primary d-flex align-items-center gap-2"
            onClick={() => { setEditTarget(null); setModalMode('create'); setModalOpen(true); }}
          >
            <i className="bi bi-plus-lg" /> Nueva propiedad
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

      <div className="section-card mb-4">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Búsqueda y filtros</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-5">
              <label className="form-label small fw-semibold">Buscar</label>
              <div className="input-group">
                <span className="input-group-text bg-white text-muted"><i className="bi bi-search" /></span>
                <input
                  ref={searchInput}
                  defaultValue={filters.search}
                  className="form-control"
                  placeholder="Código, nombre, dirección, distrito, proyecto..."
                />
              </div>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Tipo</label>
              <select
                className="form-select"
                value={filters.tipoPropiedad || ''}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, tipoPropiedad: (e.target.value as TipoPropiedad) || '' }))}
              >
                <option value="">Todos los tipos</option>
                {TIPOS_PROPIEDAD.map((t) => <option key={t} value={t}>{humanizeToken(t)}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Estado</label>
              <select
                className="form-select"
                value={filters.estado || ''}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, estado: (e.target.value as EstadoPropiedad) || '' }))}
              >
                <option value="">Todos</option>
                {ESTADOS_PROPIEDAD.map((s) => <option key={s} value={s}>{humanizeToken(s)}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Disponibilidad</label>
              <select
                className="form-select"
                value={String(filters.disponible || '')}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, disponible: (e.target.value === '' ? '' : e.target.value === 'true') as any }))}
              >
                <option value="">Todas</option>
                <option value="true">Solo disponibles</option>
                <option value="false">No disponibles</option>
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold">Proyecto</label>
              <select
                className="form-select"
                value={filters.proyectoId || ''}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, proyectoId: e.target.value }))}
              >
                <option value="">Todos los proyectos</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Ordenar por</label>
              <select
                className="form-select"
                value={filters.sortBy}
                onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as any }))}
              >
                <option value="createdAt">Fecha creación</option>
                <option value="updatedAt">Fecha actualización</option>
                <option value="codigoInterno">Código</option>
                <option value="nombre">Nombre</option>
                <option value="precio">Precio</option>
                <option value="estado">Estado</option>
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Sentido</label>
              <select
                className="form-select"
                value={filters.sortDirection}
                onChange={(e) => setFilters((f) => ({ ...f, sortDirection: e.target.value as any }))}
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small fw-semibold">Mostrar</label>
              <select
                className="form-select"
                value={filters.limit}
                onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-2 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilters({ page: 1, limit: 10, search: '', estado: '', tipoPropiedad: '', proyectoId: '', disponible: '', sortBy: 'createdAt', sortDirection: 'desc' })}
              >
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <h5 className="card-title"><i className="bi bi-list-ul me-2 text-primary" /> Listado de propiedades</h5>
          <div className="text-muted small">
            Mostrando {meta ? `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}` : '0-0'}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th>Área / Ambientes</th>
                <th>Proyecto</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && !result?.data.length && (
                <tr><td colSpan={8} className="text-center py-5">
                  <div className="spinner-border me-2" role="status" aria-hidden="true" /> Cargando...
                </td></tr>
              )}
              {!loading && !result?.data.length && (
                <tr><td colSpan={8} className="text-center py-5">
                  <div className="mx-auto mb-2" style={{ width: 56, height: 56, borderRadius: 16, background: '#eef2ff', color: '#3730a3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-buildings fs-3" />
                  </div>
                  <div className="fw-semibold">No se encontraron propiedades</div>
                  <div className="text-muted small">Ajusta los filtros o crea una nueva propiedad.</div>
                </td></tr>
              )}
              {result?.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="d-flex align-items-center gap-3">
                      <div className="avatar-sm text-bg-primary">
                        <i className={`bi ${TIPO_ICON[p.tipoPropiedad] || 'bi-tag'}`} />
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <div className="fw-semibold lh-1 small">{p.nombre}</div>
                          <span className="badge badge-soft-secondary fw-semibold" style={{ fontFamily: 'monospace', fontSize: '.65rem' }} title="ID de la propiedad (cópialo con el botón 📋)">
                            <i className="bi bi-upc me-1" />{p.id.slice(0, 12)}…
                          </span>
                        </div>
                        <div className="text-muted small mt-1 d-flex gap-2">
                          <span><i className="bi bi-upc-scan me-1" />{p.codigoInterno}</span>
                        </div>
                        <div className="text-muted small mt-1">Creado {formatDate(p.createdAt)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-soft-secondary fw-semibold">
                      <i className={`bi ${TIPO_ICON[p.tipoPropiedad] || 'bi-tag'} me-1`} />
                      {humanizeToken(p.tipoPropiedad)}
                    </span>
                  </td>
                  <td className="fw-semibold">{formatPEN(p.precio)}</td>
                  <td>
                    <div className="d-flex flex-column gap-1 small">
                      <span className="text-muted">
                        <i className="bi bi-grid-3x3-gap me-1" />Total: {p.areaTotal || '—'} m²
                      </span>
                      {p.areaConstruida != null && (
                        <span className="text-muted">
                          <i className="bi bi-layout-text-sidebar-reverse me-1" />Construida: {p.areaConstruida} m²
                        </span>
                      )}
                      <span className="text-muted d-flex flex-wrap gap-2">
                        {p.habitaciones != null && <><i className="bi bi-door-open" />{p.habitaciones} hab.</>}
                        {p.banos != null && <><i className="bi bi-droplet" />{p.banos} bañ.</>}
                        {p.estacionamientos != null && <><i className="bi bi-car-front" />{p.estacionamientos} est.</>}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="small">{p.proyecto?.nombre || '—'}</div>
                    {p.piso != null && <div className="text-muted small">Piso {p.piso}</div>}
                  </td>
                  <td>
                    <div className="small">{p.distrito || '—'}{p.ciudad ? `, ${p.ciudad}` : ''}</div>
                    {p.direccion && <div className="text-muted small d-flex align-items-start gap-1">
                      <i className="bi bi-geo-alt mt-1" />{p.direccion}
                    </div>}
                  </td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[p.estado]} fw-semibold`}>
                      {humanizeToken(p.estado)}
                    </span>
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-1 justify-content-end">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        title="Copiar ID de la propiedad (para Visita/Reserva/Venta)"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(p.id);
                            setToast({ ok: true, msg: `✅ ID copiado: ${p.id.slice(0, 10)}…` });
                          } catch {
                            setToast({ ok: false, msg: 'Cópialo manual: ' + p.id });
                          }
                        }}
                      >
                        <i className="bi bi-clipboard" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        title="Ver detalles"
                        onClick={() => alert('Detalle no implementado en este módulo')}
                      >
                        <i className="bi bi-eye" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        title="Editar"
                        onClick={() => { setEditTarget(p); setModalMode('edit'); setModalOpen(true); }}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title="Eliminar"
                        onClick={() => setConfirm({ show: true, id: p.id, msg: `¿Estás seguro de eliminar la propiedad "${p.nombre}" (${p.codigoInterno})?`, working: false })}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="card-footer border-top-0 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="text-muted small">
              Página <strong>{meta.page}</strong> de <strong>{meta.totalPages}</strong> · <strong>{meta.total}</strong> registros
            </div>
            <nav aria-label="Paginación de propiedades">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${meta.page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: 1 }))} disabled={meta.page === 1}>
                    <i className="bi bi-chevron-double-left" />
                  </button>
                </li>
                <li className={`page-item ${meta.page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, meta.page - 1) }))} disabled={meta.page === 1}>
                    <i className="bi bi-chevron-left" />
                  </button>
                </li>
                {pages.map((pn) => (
                  <li key={pn} className={`page-item ${pn === '...' ? 'disabled' : ''} ${pn === meta.page ? 'active' : ''}`}>
                    <button
                      className="page-link"
                      disabled={pn === '...'}
                      onClick={() => pn !== '...' && setFilters((f) => ({ ...f, page: pn as number }))}
                    >
                      {pn}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${meta.page === meta.totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: Math.min(meta.totalPages, meta.page + 1) }))} disabled={meta.page === meta.totalPages}>
                    <i className="bi bi-chevron-right" />
                  </button>
                </li>
                <li className={`page-item ${meta.page === meta.totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: meta.totalPages }))} disabled={meta.page === meta.totalPages}>
                    <i className="bi bi-chevron-double-right" />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      <PropiedadModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        proyectos={proyectos}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <ConfirmDeleteModal
        open={confirm.show}
        working={confirm.working}
        msg={confirm.msg}
        onCancel={() => setConfirm({ show: false, id: null, msg: '', working: false })}
        onConfirm={doDelete}
      />
    </AppLayout>
  );
}

function buildPagination(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  const l = Math.max(2, current - 1);
  const r = Math.min(total - 1, current + 1);
  if (l > 2) pages.push('...');
  for (let i = l; i <= r; i++) pages.push(i);
  if (r < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

function ConfirmDeleteModal({
  open,
  working,
  msg,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  working: boolean;
  msg: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);

  useBindBootstrapModal(ref, bsRef, open, undefined, { backdrop: 'static', keyboard: false }, onCancel);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={ref}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-body py-4">
            <div className="d-flex align-items-start gap-3">
              <div className="avatar-sm text-bg-danger flex-shrink-0">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div className="flex-1">
                <h6 className="fw-bold mb-2">Confirmar eliminación</h6>
                <p className="text-muted small mb-0">{msg}</p>
              </div>
            </div>
          </div>
          <div className="modal-footer pt-0 border-top-0">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCancel}
              disabled={working}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              disabled={working}
            >
              {working && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              Sí, eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
