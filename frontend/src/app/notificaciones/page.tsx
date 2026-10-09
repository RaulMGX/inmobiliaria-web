'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDateTime, getSession, http, initials } from '@/lib/api';
import {
  NOTIFICACION_BADGE,
  NOTIFICACION_ICON,
  NotifPaginated,
  NotifPendientes,
  Notificacion,
  SincronizarNotifResult,
  TIPOS_NOTIFICACION,
  TipoNotificacion,
} from '@/lib/reportes-notificaciones';

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

type LeidoFilter = '' | 'leida' | 'no-leida';

export default function NotificacionesPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';
  const usuarioId = sess?.usuario.id || '';
  const rol = String(sess?.usuario.rolNombre || '').toUpperCase();
  const esAdmin = rol === 'ADMIN';
  const asesorFilter = esAdmin ? undefined : usuarioId;

  const [filters, setFilters] = useState<{ page: number; limit: number; tipo: TipoNotificacion | ''; leida: LeidoFilter }>({
    page: 1, limit: 10, tipo: '', leida: '',
  });

  const [data, setData] = useState<NotifPaginated | null>(null);
  const [pendientes, setPendientes] = useState<NotifPendientes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const fetchAll = useCallback(async (q: typeof filters) => {
    if (!empresaId) return;
    setLoading(true); setError(null); setSyncMsg(null);
    try {
      const paramsList: any = { page: q.page, limit: q.limit };
      if (asesorFilter) paramsList.asesorId = asesorFilter;
      if (q.tipo) paramsList.tipo = q.tipo;
      if (q.leida === 'leida') paramsList.leida = true;
      else if (q.leida === 'no-leida') paramsList.leida = false;

      const base = `/empresas/${empresaId}/notificaciones`;
      const pendParams: any = {};
      if (asesorFilter) pendParams.asesorId = asesorFilter;
      const [list, pend] = await Promise.all([
        http.get<NotifPaginated>(`${base}`, { params: paramsList }),
        http.get<NotifPendientes>(`${base}/pendientes/contador`, { params: pendParams }),
      ]);
      setData(list.data);
      setPendientes(pend.data);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar las notificaciones.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, asesorFilter]);

  useEffect(() => { fetchAll(filters); /* eslint-disable-next-line */ }, [filters.page, filters.limit, filters.tipo, filters.leida]);

  const refreshContador = useCallback(async () => {
    if (!empresaId) return;
    try {
      const params: any = {};
      if (asesorFilter) params.asesorId = asesorFilter;
      const { data } = await http.get<NotifPendientes>(`/empresas/${empresaId}/notificaciones/pendientes/contador`, { params });
      setPendientes(data);
    } catch { /* ignore */ }
  }, [empresaId, asesorFilter]);

  async function onToggle(id: string, actual: boolean) {
    if (!empresaId) return;
    setToggleLoading(id);
    try {
      await http.patch(`/empresas/${empresaId}/notificaciones/${id}/leida`, { leida: !actual });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((n) => n.id === id ? { ...n, leida: !actual, fechaLeida: !actual ? new Date().toISOString() : null } : n),
        };
      });
      await refreshContador();
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo actualizar la notificación.');
    } finally {
      setToggleLoading(null);
    }
  }

  async function onMarcarTodas() {
    if (!empresaId) return;
    setMarkAllLoading(true);
    try {
      const params: any = {};
      if (asesorFilter) params.asesorId = asesorFilter;
      await http.patch(`/empresas/${empresaId}/notificaciones/marcar-todas-leidas`, undefined, { params });
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, data: prev.data.map((n) => ({ ...n, leida: true, fechaLeida: n.fechaLeida || new Date().toISOString() })) };
      });
      await refreshContador();
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudieron marcar todas como leídas.');
    } finally {
      setMarkAllLoading(false);
    }
  }

  async function onSincronizar() {
    if (!empresaId) return;
    setSyncLoading(true); setSyncMsg(null);
    try {
      const params: any = {};
      if (asesorFilter) params.asesorId = asesorFilter;
      const { data } = await http.post<SincronizarNotifResult>(`/empresas/${empresaId}/notificaciones/sincronizar`, undefined, { params });
      setSyncMsg(`Sincronización exitosa: ${data.creadas} creadas, ${data.actualizadas} actualizadas.`);
      await fetchAll(filters);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo sincronizar las notificaciones.');
    } finally {
      setSyncLoading(false);
    }
  }

  const pages = useMemo(() => buildPages(filters.page, data?.meta.totalPages ?? 1), [filters.page, data?.meta.totalPages]);
  const totalPendientes = pendientes?.totalPendientes ?? 0;

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-subtitle">Gestiona alertas de seguimientos pendientes, visitas próximas, reservas por vencer y tareas.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2" onClick={onSincronizar} disabled={syncLoading || loading}>
            {syncLoading && <span className="spinner-border spinner-border-sm" />}
            <i className="bi bi-arrow-repeat" /> Sincronizar
          </button>
          <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-2" onClick={onMarcarTodas} disabled={markAllLoading || loading}>
            {markAllLoading && <span className="spinner-border spinner-border-sm" />}
            <i className="bi bi-check2-all" /> Marcar todas leídas
          </button>
        </div>
      </div>

      {syncMsg && <div className="alert alert-success small mb-3 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-check-circle-fill mt-1" /><div>{syncMsg}</div></div>}
      {error && <div className="alert alert-danger small mb-3 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="section-card border-0 h-100">
            <div className="card-body d-flex align-items-center gap-3 p-3">
              <div className="flex-shrink-0" style={{ width: 52, height: 52, borderRadius: 14, background: '#fef2f2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-bell-fill fs-4" />
              </div>
              <div className="flex-grow-1 min-w-0">
                <div className="text-muted small" style={{ fontSize: '.8rem' }}>Notificaciones pendientes</div>
                <div className="fw-bold fs-3">{totalPendientes}</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {Object.entries(pendientes?.porTipo ?? {}).length === 0 && <span className="text-muted small">Sin pendientes</span>}
                  {Object.entries(pendientes?.porTipo ?? {}).map(([k, v]) => (
                    <span key={k} className={`badge ${NOTIFICACION_BADGE[k as TipoNotificacion] ?? 'badge-soft-secondary'} fw-semibold`} style={{ fontSize: '.65rem' }}>
                      {k.replace(/_/g, ' ')} · {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="section-card mb-0">
            <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5></div>
            <div className="card-body pb-2">
              <div className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold mb-1">Tipo</label>
                  <select className="form-select form-select-sm" value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, page: 1, tipo: e.target.value as any }))}>
                    <option value="">Todos los tipos</option>
                    {TIPOS_NOTIFICACION.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold mb-1">Estado</label>
                  <select className="form-select form-select-sm" value={filters.leida} onChange={(e) => setFilters((f) => ({ ...f, page: 1, leida: e.target.value as LeidoFilter }))}>
                    <option value="">Todas</option>
                    <option value="no-leida">No leídas</option>
                    <option value="leida">Leídas</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold mb-1">Por página</label>
                  <select className="form-select form-select-sm" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="section-card"><div className="card-body text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando notificaciones...</div></div>}

      {!loading && (
        <div className="section-card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
            <h5 className="card-title"><i className="bi bi-list-ul me-2 text-primary" /> Listado de notificaciones</h5>
            <div className="text-muted small" style={{ fontSize: '.8rem' }}>{data?.meta.total ?? 0} registros</div>
          </div>
          <div className="card-body p-0">
            {!data || data.data.length === 0 ? (
              <div className="text-center py-5 px-3">
                <div className="mb-3 text-muted" style={{ fontSize: '2.5rem' }}><i className="bi bi-inbox" /></div>
                <div className="fw-semibold mb-1">Sin notificaciones</div>
                <div className="text-muted small mb-3">No se encontraron notificaciones para los filtros seleccionados.</div>
                <button className="btn btn-sm btn-outline-primary" onClick={onSincronizar} disabled={syncLoading}>
                  {syncLoading && <span className="spinner-border spinner-border-sm me-1" />}
                  <i className="bi bi-arrow-repeat me-1" /> Sincronizar ahora
                </button>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {data.data.map((n) => (
                  <NotifRow key={n.id} n={n} loadingToggle={toggleLoading === n.id} onToggle={() => onToggle(n.id, n.leida)} />
                ))}
              </div>
            )}
          </div>
          {data && data.meta.totalPages > 1 && (
            <div className="card-footer border-0 d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2">
              <div className="text-muted small" style={{ fontSize: '.78rem' }}>Página {filters.page} de {data.meta.totalPages}</div>
              <nav aria-label="Paginación notificaciones">
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
      )}
    </AppLayout>
  );
}

function NotifRow({ n, loadingToggle, onToggle }: { n: Notificacion; loadingToggle: boolean; onToggle: () => void }) {
  const avatarColor = n.leida ? '#f3f4f6|#6b7280' : (n.tipo === 'SEGUIMIENTO_PENDIENTE' ? '#fef3c7|#92400e' : n.tipo === 'VISITA_PROXIMA' ? '#dbeafe|#1e40af' : n.tipo === 'RESERVA_POR_VENCER' ? '#fee2e2|#991b1b' : '#e0e7ff|#3730a3');
  const [bg, fg] = avatarColor.split('|');
  return (
    <div className={`list-group-item border-0 px-3 py-2 d-flex align-items-start gap-3 ${n.leida ? 'bg-white' : 'bg-light'}`} style={{ opacity: n.leida ? 0.88 : 1 }}>
      <div className="flex-shrink-0 mt-1" style={{ width: 40, height: 40, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className={NOTIFICACION_ICON[n.tipo]} />
      </div>
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className={`badge ${NOTIFICACION_BADGE[n.tipo]} fw-semibold`} style={{ fontSize: '.65rem' }}>{n.tipo.replace(/_/g, ' ')}</span>
              {!n.leida && <span className="badge bg-danger fw-semibold" style={{ fontSize: '.65rem' }}>Pendiente</span>}
              {n.leida && <span className="badge bg-light text-muted border fw-semibold" style={{ fontSize: '.65rem' }}>Leída</span>}
            </div>
            <div className={`fw-semibold small mt-1 ${n.leida ? '' : 'text-primary'}`}>{n.titulo}</div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <span className="text-muted small" style={{ fontSize: '.72rem' }}>{formatDateTime(n.fechaNotificacion)}</span>
            <button className={`btn btn-sm ${n.leida ? 'btn-outline-secondary' : 'btn-outline-primary'} d-flex align-items-center gap-1`} onClick={onToggle} disabled={loadingToggle}>
              {loadingToggle && <span className="spinner-border spinner-border-sm" />}
              <i className={`bi ${n.leida ? 'bi-envelope-open' : 'bi-envelope'}`} />
              <span className="d-none d-sm-inline">{n.leida ? 'Marcar no leída' : 'Marcar leída'}</span>
            </button>
          </div>
        </div>
        {n.mensaje && <div className="small text-muted mt-1" style={{ fontSize: '.82rem' }}>{n.mensaje}</div>}
        <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
          <div className="d-flex align-items-center gap-1">
            <div className="avatar avatar-sm rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-semibold" style={{ width: 22, height: 22, fontSize: '.68rem', background: '#4f46e5' }}>
              {initials(n.asesor?.nombres || 'A', n.asesor?.apellidos)}
            </div>
            <span className="small text-muted" style={{ fontSize: '.75rem' }}>
              {n.asesor?.nombres} {n.asesor?.apellidos}
            </span>
          </div>
          {n.fechaLeida && <span className="small text-muted" style={{ fontSize: '.7rem' }}>· Leída: {formatDateTime(n.fechaLeida)}</span>}
        </div>
      </div>
    </div>
  );
}
