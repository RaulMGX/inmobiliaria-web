'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDate, getSession, http } from '@/lib/api';

type Plataforma = 'FACEBOOK' | 'INSTAGRAM';

interface Campana {
  id: string;
  empresaId: string;
  nombreCampana: string;
  plataforma: Plataforma;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  proyectoIds: string[];
  propiedadIds: string[];
  fechaInicio: string | null;
  fechaFin: string | null;
  observaciones: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { clientes: number; conversaciones: number };
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface CampanaInput {
  nombreCampana: string;
  plataforma: Plataforma;
  campaignId: string;
  adsetId: string;
  adId: string;
  fechaInicio: string;
  fechaFin: string;
  observaciones: string;
}

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

function emptyInput(): CampanaInput {
  return {
    nombreCampana: '',
    plataforma: 'FACEBOOK',
    campaignId: '',
    adsetId: '',
    adId: '',
    fechaInicio: '',
    fechaFin: '',
    observaciones: '',
  };
}

const PLATAFORMA_BADGE: Record<Plataforma, { cls: string; label: string; icon: string }> = {
  FACEBOOK: { cls: 'bg-blue-100 text-blue-700', label: 'Facebook', icon: 'bi-facebook' },
  INSTAGRAM: { cls: 'bg-pink-100 text-pink-700', label: 'Instagram', icon: 'bi-instagram' },
};

export default function CampanasPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState({ page: 1, limit: 10, buscar: '', plataforma: '' as '' | Plataforma });
  const [data, setData] = useState<Paginated<Campana> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Campana | null>(null);
  const [form, setForm] = useState<CampanaInput>(emptyInput());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalSaving, setModalSaving] = useState(false);
  const [modalGlobalErr, setModalGlobalErr] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  function getBs() {
    if (typeof window === 'undefined') return null;
    return (window as any).bootstrap || null;
  }
  function getModal(ref: React.MutableRefObject<HTMLDivElement | null>) {
    const B = getBs();
    if (!B?.Modal || !ref.current) return null;
    return B.Modal.getOrCreateInstance(ref.current, { backdrop: 'static', keyboard: false });
  }
  function showModal(ref: React.MutableRefObject<HTMLDivElement | null>) {
    let cancelled = false;
    let tries = 0;
    const t = () => {
      if (cancelled) return;
      const m = getModal(ref);
      if (m) { m.show(); return; }
      if (tries++ < 150) { window.setTimeout(t, 30); return; }
    };
    t();
    return () => { cancelled = true; };
  }
  function hideModal(ref: React.MutableRefObject<HTMLDivElement | null>) {
    const m = getModal(ref);
    if (m) m.hide();
  }

  const fetchPage = useCallback(async (q: typeof filters) => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: q.page, limit: q.limit };
      if (q.buscar) params.buscar = q.buscar;
      if (q.plataforma) params.plataforma = q.plataforma;
      const { data: res } = await http.get<Paginated<Campana>>(`/empresas/${empresaId}/campanas`, { params });
      setData(res);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar las campañas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { fetchPage(filters); /* eslint-disable-next-line */ }, [filters.page, filters.limit, filters.plataforma]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const pages = useMemo(() => buildPages(filters.page, data?.meta.totalPages ?? 1), [filters.page, data?.meta.totalPages]);

  function openCreate() {
    setMode('create');
    setEditing(null);
    setFormErrors({});
    setModalGlobalErr(null);
    setForm(emptyInput());
    showModal(modalRef);
  }
  function openEdit(c: Campana) {
    setMode('edit');
    setEditing(c);
    setFormErrors({});
    setModalGlobalErr(null);
    setForm({
      nombreCampana: c.nombreCampana,
      plataforma: c.plataforma,
      campaignId: c.campaignId || '',
      adsetId: c.adsetId || '',
      adId: c.adId || '',
      fechaInicio: c.fechaInicio ? c.fechaInicio.slice(0, 10) : '',
      fechaFin: c.fechaFin ? c.fechaFin.slice(0, 10) : '',
      observaciones: c.observaciones || '',
    });
    showModal(modalRef);
  }
  function closeModal() {
    hideModal(modalRef);
    setEditing(null);
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!form.nombreCampana.trim()) e.nombreCampana = 'Nombre de campaña requerido.';
    else if (form.nombreCampana.trim().length > 150) e.nombreCampana = 'Máximo 150 caracteres.';
    if (!form.adId.trim()) e.adId = 'El Ad ID es obligatorio (vincula el anuncio con WhatsApp).';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setModalGlobalErr(null);
    if (!sess) return;
    if (!validateForm()) return;
    setModalSaving(true);
    try {
      const payload: any = {
        nombreCampana: form.nombreCampana.trim(),
        plataforma: form.plataforma,
        campaignId: form.campaignId.trim() || null,
        adsetId: form.adsetId.trim() || null,
        adId: form.adId.trim(),
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
        observaciones: form.observaciones.trim() || null,
      };
      if (mode === 'create') {
        await http.post(`/empresas/${sess.usuario.empresaId}/campanas`, payload);
        setToast('Campaña creada correctamente.');
      } else if (mode === 'edit' && editing) {
        await http.patch(`/empresas/${sess.usuario.empresaId}/campanas/${editing.id}`, payload);
        setToast('Campaña actualizada correctamente.');
      }
      closeModal();
      fetchPage(filters);
    } catch (err) {
      const e = err as AxiosError<any>;
      const msg = e.response?.data?.message;
      setModalGlobalErr(Array.isArray(msg) ? msg[0] : msg || 'No se pudo guardar la campaña.');
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDelete(c: Campana) {
    if (!sess) return;
    const ok = window.confirm(`¿Desactivar la campaña "${c.nombreCampana}"?`);
    if (!ok) return;
    try {
      await http.delete(`/empresas/${sess.usuario.empresaId}/campanas/${c.id}`);
      setToast('Campaña desactivada correctamente.');
      fetchPage(filters);
    } catch (err) {
      const e = err as AxiosError<any>;
      setError(e.response?.data?.message || 'No se pudo desactivar la campaña.');
    }
  }

  async function copiarAdId(adId: string) {
    try {
      await navigator.clipboard.writeText(adId);
      setToast('Ad ID copiado al portapapeles.');
    } catch {
      setToast('No se pudo copiar.');
    }
  }

  return (
    <AppLayout>
      {toast && (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1090 }}>
          <div className="toast show align-items-center text-bg-success border-0" role="alert">
            <div className="d-flex">
              <div className="toast-body small"><i className="bi bi-check-circle-fill me-2" />{toast}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} aria-label="Cerrar" />
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Campañas publicitarias</h1>
          <p className="page-subtitle">
            Registra tus anuncios de Facebook e Instagram. El <b>Ad ID</b> vincula cada anuncio con el WhatsApp del negocio:
            cuando un cliente presiona &quot;Más información&quot; en el anuncio, abre WhatsApp y la IA recibe el contexto de la campaña.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2" onClick={openCreate}>
          <i className="bi bi-megaphone-fill" /> Nueva campaña
        </button>
      </div>

      {error && <div className="alert alert-danger small mb-3 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-3">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5></div>
        <div className="card-body pb-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label small fw-semibold mb-1">Buscar</label>
              <input
                className="form-control form-control-sm"
                placeholder="Nombre, Campaign ID o Ad ID..."
                defaultValue={filters.buscar}
                onChange={(e) => {
                  const v = e.target.value;
                  window.setTimeout(() => {
                    const q = { ...filters, page: 1, buscar: v };
                    setFilters(q);
                    fetchPage(q);
                  }, 350);
                }}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Plataforma</label>
              <select className="form-select form-select-sm" value={filters.plataforma} onChange={(e) => setFilters((f) => ({ ...f, page: 1, plataforma: e.target.value as any }))}>
                <option value="">Todas</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="INSTAGRAM">Instagram</option>
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
          <h5 className="card-title"><i className="bi bi-megaphone me-2 text-primary" /> Listado de campañas</h5>
          <div className="text-muted small" style={{ fontSize: '.8rem' }}>{data?.meta.total ?? 0} registros</div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle small">
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Plataforma</th>
                <th>Ad ID</th>
                <th>Clientes</th>
                <th>Conversaciones</th>
                <th>Creada</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-4 text-muted"><div className="spinner-border spinner-border-sm me-2" /> Cargando campañas...</td></tr>
              )}
              {!loading && (!data || data.data.length === 0) && (
                <tr><td colSpan={7} className="text-center py-4 text-muted small">Sin campañas para los filtros seleccionados.</td></tr>
              )}
              {!loading && data?.data.map((c) => {
                const badge = PLATAFORMA_BADGE[c.plataforma];
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-semibold text-truncate">{c.nombreCampana}</div>
                      <div className="text-muted" style={{ fontSize: '.72rem' }}>
                        {c.campaignId ? `Camp: ${c.campaignId}` : 'Sin Campaign ID'}
                        {c.adsetId ? ` · Set: ${c.adsetId}` : ''}
                      </div>
                    </td>
                    <td><span className={`badge ${badge.cls} fw-semibold d-inline-flex align-items-center gap-1`} style={{ fontSize: '.7rem' }}><i className={`bi ${badge.icon}`} /> {badge.label}</span></td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <code className="small text-muted" style={{ fontSize: '.7rem' }}>{c.adId || '—'}</code>
                        {c.adId && (
                          <button type="button" className="btn btn-sm btn-link p-0" title="Copiar Ad ID" onClick={() => copiarAdId(c.adId!)}><i className="bi bi-clipboard" /></button>
                        )}
                      </div>
                    </td>
                    <td><span className="badge badge-soft-secondary fw-semibold" style={{ fontSize: '.7rem' }}>{c._count?.clientes ?? 0}</span></td>
                    <td><span className="badge badge-soft-secondary fw-semibold" style={{ fontSize: '.7rem' }}>{c._count?.conversaciones ?? 0}</span></td>
                    <td className="small">{formatDate(c.createdAt)}</td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button type="button" className="btn btn-sm btn-outline-primary" title="Editar campaña" onClick={() => openEdit(c)}><i className="bi bi-pencil-square" /></button>
                        <button type="button" className="btn btn-sm btn-outline-danger" title="Desactivar campaña" onClick={() => handleDelete(c)}><i className="bi bi-trash" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.meta.totalPages > 1 && (
          <div className="card-footer border-0 d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2">
            <div className="text-muted small" style={{ fontSize: '.78rem' }}>Página {filters.page} de {data.meta.totalPages}</div>
            <nav aria-label="Paginación campañas">
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

      {/* Modal: Crear / Editar campaña */}
      <div id="campanasFormModal" className="modal fade" ref={modalRef} tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-header">
                <h5 className="modal-title"><i className={`bi ${mode === 'create' ? 'bi-megaphone-fill' : 'bi-pencil-square'} me-2 text-primary`} />{mode === 'create' ? 'Nueva campaña' : 'Editar campaña'}</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" onClick={() => setEditing(null)} />
              </div>
              <div className="modal-body">
                {modalGlobalErr && <div className="alert alert-danger small py-2 mb-3 d-flex align-items-start gap-2" role="alert"><i className="bi bi-exclamation-circle mt-1" /><div>{modalGlobalErr}</div></div>}
                <div className="row g-2">
                  <div className="col-md-8">
                    <label className="form-label small fw-semibold mb-1">Nombre de la campaña <span className="text-danger">*</span></label>
                    <input className={`form-control form-control-sm ${formErrors.nombreCampana ? 'is-invalid' : ''}`} value={form.nombreCampana} onChange={(e) => setForm({ ...form, nombreCampana: e.target.value })} placeholder="Ej. Lotes San Miguel - Facebook" />
                    {formErrors.nombreCampana && <div className="invalid-feedback small">{formErrors.nombreCampana}</div>}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold mb-1">Plataforma <span className="text-danger">*</span></label>
                    <select className="form-select form-select-sm" value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value as Plataforma })}>
                      <option value="FACEBOOK">Facebook</option>
                      <option value="INSTAGRAM">Instagram</option>
                    </select>
                  </div>
                  <div className="col-md-12">
                    <label className="form-label small fw-semibold mb-1">Ad ID <span className="text-danger">*</span></label>
                    <input className={`form-control form-control-sm ${formErrors.adId ? 'is-invalid' : ''}`} value={form.adId} onChange={(e) => setForm({ ...form, adId: e.target.value })} placeholder="Ej. 120123456789012345" />
                    {formErrors.adId && <div className="invalid-feedback small">{formErrors.adId}</div>}
                    <div className="form-text small">Identificador del anuncio en Meta Ads Manager. Es el dato que vincula el clic del cliente con esta campaña.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Campaign ID (opcional)</label>
                    <input className="form-control form-control-sm" value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} placeholder="ID de la campaña en Meta" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Ad Set ID (opcional)</label>
                    <input className="form-control form-control-sm" value={form.adsetId} onChange={(e) => setForm({ ...form, adsetId: e.target.value })} placeholder="ID del conjunto de anuncios" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Fecha de inicio</label>
                    <input type="date" className="form-control form-control-sm" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Fecha de fin</label>
                    <input type="date" className="form-control form-control-sm" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold mb-1">Observaciones</label>
                    <textarea className="form-control form-control-sm" rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Notas internas sobre la campaña (no se muestran al cliente)." />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal" onClick={() => setEditing(null)} disabled={modalSaving}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2" disabled={modalSaving}>
                  {modalSaving && <div className="spinner-border spinner-border-sm" aria-hidden="true" />}
                  <i className={`bi ${mode === 'create' ? 'bi-save' : 'bi-pencil'}`} />
                  {mode === 'create' ? 'Crear campaña' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
