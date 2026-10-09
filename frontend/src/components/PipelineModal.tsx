'use client';

import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { getSession, http, initials } from '@/lib/api';
import { useBindBootstrapModal } from '@/lib/bootstrap-modal';
import {
  AsesorLight,
  ClienteLight,
  CreatePipelineInput,
  ETAPAS_PIPELINE,
  EtapaPipeline,
  PipelineOportunidad,
  PRIORIDADES_PIPELINE,
  PrioridadPipeline,
  UpdatePipelineInput,
} from '@/lib/pipeline';

type Mode = 'create' | 'edit';

function toInputLocal(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function toISO(d: string): string {
  if (!d) return '';
  return new Date(d).toISOString();
}

export default function PipelineModal({
  open,
  mode,
  initial,
  clientes,
  asesores,
  onClose,
  onSaved,
  onNewRef,
}: {
  open: boolean;
  mode: Mode;
  initial: PipelineOportunidad | null;
  clientes: ClienteLight[];
  asesores: AsesorLight[];
  onClose: () => void;
  onSaved: (p: PipelineOportunidad, mode: Mode) => void;
  onNewRef: (kind: 'cliente' | 'asesor', ref: { id: string; nombres: string; apellidos: string; correo?: string; celular?: string }) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const [form, setForm] = useState<CreatePipelineInput>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customCliente, setCustomCliente] = useState(false);
  const [customClienteForm, setCustomClienteForm] = useState({ id: '', nombres: '', apellidos: '', correo: '', celular: '' });
  const [customAsesor, setCustomAsesor] = useState(false);
  const [customAsesorForm, setCustomAsesorForm] = useState({ id: '', nombres: '', apellidos: '', correo: '' });
  const [lookingCliente, setLookingCliente] = useState(false);
  const debLookupRef = useRef<number | undefined>(undefined);

  function empty(): CreatePipelineInput {
    const yo = sess?.usuario;
    const asesorActual =
      asesores.find((a) => a.id === yo?.id) ??
      (yo ? ({ id: yo.id, nombres: yo.nombres || '', apellidos: yo.apellidos || '', correo: yo.correo || null } as AsesorLight) : null);
    const defaultCliente = clientes[0] || null;
    return {
      clienteId: defaultCliente?.id || '',
      asesorId: asesorActual?.id || asesores[0]?.id || yo?.id || '',
      etapa: 'NUEVO',
      prioridad: 'MEDIA',
      probabilidadCierre: 10,
      fechaIngreso: new Date().toISOString(),
      fechaUltimoSeguimiento: null,
      proximaFechaSeguimiento: null,
      motivoPerdida: null,
      observaciones: null,
    };
  }

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, mode]);

  useEffect(() => {
    if (mode !== 'create' || initial) return;
    if (customCliente && clientes.length > 0) {
      setCustomCliente(false);
      setForm((f) => ({ ...f, clienteId: clientes[0]?.id || f.clienteId }));
    }
    const yo = sess?.usuario;
    const tieneYo = asesores.some((a) => a.id === yo?.id);
    if (customAsesor && (asesores.length > 0 || yo)) {
      setCustomAsesor(false);
      const pickId = tieneYo ? yo!.id : asesores[0]?.id || yo?.id || '';
      setForm((f) => ({ ...f, asesorId: pickId || f.asesorId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes.length, asesores.length, open]);

  useEffect(() => {
    if (!customCliente) return;
    const id = customClienteForm.id.trim();
    if (!id) return;
    if (debLookupRef.current) window.clearTimeout(debLookupRef.current);
    debLookupRef.current = window.setTimeout(async () => {
      const local = clientes.find((c) => c.id === id);
      if (local) {
        setCustomClienteForm({
          id,
          nombres: local.nombres,
          apellidos: local.apellidos,
          correo: local.correo || '',
          celular: local.celular || '',
        });
        return;
      }
      if (!sess?.usuario.empresaId) return;
      setLookingCliente(true);
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/clientes/${encodeURIComponent(id)}`);
        const c = data?.data ?? data;
        if (c?.id) {
          setCustomClienteForm({
            id: c.id,
            nombres: c.nombres || '',
            apellidos: c.apellidos || '',
            correo: c.correo || '',
            celular: c.celular || '',
          });
          if (typeof onNewRef === 'function') onNewRef('cliente', { id: c.id, nombres: c.nombres || '', apellidos: c.apellidos || '', correo: c.correo || undefined, celular: c.celular || undefined });
        }
      } catch {
        /* ignore: ID no encontrado — usuario completa manual */
      } finally {
        setLookingCliente(false);
      }
    }, 450);
    return () => {
      if (debLookupRef.current) window.clearTimeout(debLookupRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customClienteForm.id, customCliente, clientes]);

  useBindBootstrapModal(modalRef, bsRef, open, undefined, { backdrop: 'static', keyboard: false });

  function reset() {
    if (initial) {
      setForm({
        clienteId: initial.clienteId,
        asesorId: initial.asesorId,
        etapa: initial.etapa,
        prioridad: initial.prioridad,
        probabilidadCierre: initial.probabilidadCierre,
        fechaIngreso: initial.fechaIngreso,
        fechaUltimoSeguimiento: initial.fechaUltimoSeguimiento,
        proximaFechaSeguimiento: initial.proximaFechaSeguimiento,
        motivoPerdida: initial.motivoPerdida,
        observaciones: initial.observaciones,
      });
      setCustomCliente(!clientes.find((c) => c.id === initial.clienteId));
      setCustomClienteForm({
        id: initial.clienteId,
        nombres: initial.cliente.nombres,
        apellidos: initial.cliente.apellidos,
        correo: initial.cliente.correo || '',
        celular: initial.cliente.celular || '',
      });
      setCustomAsesor(!asesores.find((a) => a.id === initial.asesorId));
      setCustomAsesorForm({
        id: initial.asesorId,
        nombres: initial.asesor.nombres,
        apellidos: initial.asesor.apellidos,
        correo: initial.asesor.correo || '',
      });
    } else {
      setForm(empty());
      setCustomCliente(clientes.length === 0);
      setCustomAsesor(asesores.length === 0);
      setCustomClienteForm({ id: '', nombres: '', apellidos: '', correo: '', celular: '' });
      setCustomAsesorForm({ id: sess?.usuario.id || '', nombres: sess?.usuario.nombres || '', apellidos: sess?.usuario.apellidos || '', correo: sess?.usuario.correo || '' });
    }
    setErrors({});
    setGlobalErr(null);
  }

  function setField<K extends keyof CreatePipelineInput>(k: K, v: CreatePipelineInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (customCliente) {
      if (!customClienteForm.id.trim()) e.clienteId = 'ID del cliente es requerido.';
      if (!customClienteForm.nombres.trim()) e.clienteNombre = 'Nombres del cliente son requeridos.';
    } else if (!form.clienteId) e.clienteId = 'Selecciona un cliente.';
    if (customAsesor) {
      if (!customAsesorForm.id.trim()) e.asesorId = 'ID del asesor es requerido.';
      if (!customAsesorForm.nombres.trim()) e.asesorNombre = 'Nombres del asesor son requeridos.';
    } else if (!form.asesorId) e.asesorId = 'Selecciona un asesor.';
    if (form.probabilidadCierre == null || form.probabilidadCierre < 0 || form.probabilidadCierre > 100) e.probabilidadCierre = 'Probabilidad 0-100.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setGlobalErr(null);
    if (!sess) return;
    if (!validate()) return;

    if (customCliente) onNewRef('cliente', { id: customClienteForm.id.trim(), nombres: customClienteForm.nombres.trim(), apellidos: customClienteForm.apellidos.trim(), correo: customClienteForm.correo.trim() || undefined, celular: customClienteForm.celular.trim() || undefined });
    if (customAsesor) onNewRef('asesor', { id: customAsesorForm.id.trim(), nombres: customAsesorForm.nombres.trim(), apellidos: customAsesorForm.apellidos.trim(), correo: customAsesorForm.correo.trim() || undefined });

    const payload: CreatePipelineInput = {
      ...form,
      clienteId: customCliente ? customClienteForm.id.trim() : form.clienteId,
      asesorId: customAsesor ? customAsesorForm.id.trim() : form.asesorId,
      fechaIngreso: form.fechaIngreso ? toISO(toInputLocal(form.fechaIngreso)) : undefined,
      fechaUltimoSeguimiento: form.fechaUltimoSeguimiento ? toISO(toInputLocal(form.fechaUltimoSeguimiento)) : null,
      proximaFechaSeguimiento: form.proximaFechaSeguimiento ? toISO(toInputLocal(form.proximaFechaSeguimiento)) : null,
    };

    setSaving(true);
    try {
      const url = `/empresas/${sess.usuario.empresaId}/pipeline` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const body: UpdatePipelineInput | CreatePipelineInput = mode === 'edit' ? payload : payload;
      const { data } = await method<PipelineOportunidad>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar la oportunidad.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nueva oportunidad' : `Editar oportunidad ${initial?.id?.slice(0, 8) || ''}`;

  return (
    <div className="modal fade" id="pipelineModal" tabIndex={-1} aria-hidden="true" ref={modalRef} data-bs-backdrop="static">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="pipelineModalLabel">
              <i className="bi bi-diagram-3 me-2 text-primary" />
              {title}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && (
              <div className="alert alert-danger small d-flex align-items-center gap-2 py-2" role="alert">
                <i className="bi bi-exclamation-triangle-fill" />
                <div>{globalErr}</div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="d-flex gap-2 mb-2">
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="rbCliSel" name="rbCli" checked={!customCliente} onChange={() => setCustomCliente(false)} />
                    <label className="form-check-label small" htmlFor="rbCliSel">Seleccionar cliente existente</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="rbCliMan" name="rbCli" checked={customCliente} onChange={() => setCustomCliente(true)} />
                    <label className="form-check-label small" htmlFor="rbCliMan">Referenciar por ID (manual)</label>
                  </div>
                </div>
                {!customCliente ? (
                  <div>
                    <label className="form-label small fw-semibold">Cliente *</label>
                    <select className={`form-select ${errors.clienteId ? 'is-invalid' : ''}`} value={form.clienteId} onChange={(e) => setField('clienteId', e.target.value)}>
                      <option value="">-- Selecciona un cliente --</option>
                      {clientes.length === 0 && <option value="" disabled>⚠️ No hay clientes cargados. Crea uno en el módulo Clientes o activa "Referenciar por ID (manual)".</option>}
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} {c.correo ? `· ${c.correo}` : ''} {c.celular ? `· ${c.celular}` : ''}</option>)}
                    </select>
                    {errors.clienteId && <div className="invalid-feedback d-block small">{errors.clienteId}</div>}
                  </div>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                        <span>ID del cliente *</span>
                        {lookingCliente && (
                          <span className="small text-info d-inline-flex align-items-center gap-1">
                            <span className="spinner-border spinner-border-sm" /> Buscando cliente…
                          </span>
                        )}
                      </label>
                      <input className={`form-control ${errors.clienteId ? 'is-invalid' : ''}`} value={customClienteForm.id} onChange={(e) => setCustomClienteForm((f) => ({ ...f, id: e.target.value }))} placeholder="Copia el ID desde Clientes y pégalo aquí (se llenarán los datos solos)" />
                      {errors.clienteId && <div className="invalid-feedback d-block small">{errors.clienteId}</div>}
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1">
                        <i className="bi bi-lightbulb text-warning" />
                        Tip: en <b>Clientes</b> pulsa el botón 📋 para copiar el ID; al pegarlo aquí se autocompletan Nombres, Correo y Celular.
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Nombres *</label>
                      <input className={`form-control ${errors.clienteNombre ? 'is-invalid' : ''}`} value={customClienteForm.nombres} onChange={(e) => setCustomClienteForm((f) => ({ ...f, nombres: e.target.value }))} />
                      {errors.clienteNombre && <div className="invalid-feedback d-block small">{errors.clienteNombre}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Apellidos</label>
                      <input className="form-control" value={customClienteForm.apellidos} onChange={(e) => setCustomClienteForm((f) => ({ ...f, apellidos: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Correo</label>
                      <input type="email" className="form-control" value={customClienteForm.correo} onChange={(e) => setCustomClienteForm((f) => ({ ...f, correo: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Celular</label>
                      <input className="form-control" value={customClienteForm.celular} onChange={(e) => setCustomClienteForm((f) => ({ ...f, celular: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              <div className="col-12 col-md-6">
                <div className="d-flex gap-2 mb-2">
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="rbAsSel" name="rbAs" checked={!customAsesor} onChange={() => setCustomAsesor(false)} />
                    <label className="form-check-label small" htmlFor="rbAsSel">Seleccionar asesor</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="rbAsMan" name="rbAs" checked={customAsesor} onChange={() => setCustomAsesor(true)} />
                    <label className="form-check-label small" htmlFor="rbAsMan">Referenciar por ID (manual)</label>
                  </div>
                </div>
                {!customAsesor ? (
                  <div>
                    <label className="form-label small fw-semibold">Asesor *</label>
                    <select className={`form-select ${errors.asesorId ? 'is-invalid' : ''}`} value={form.asesorId} onChange={(e) => setField('asesorId', e.target.value)}>
                      <option value="">-- Selecciona un asesor --</option>
                      {asesores.length === 0 && <option value="" disabled>⚠️ Sin asesores en caché — activa opción manual</option>}
                      {asesores.map((a) => {
                        const soyYo = sess?.usuario?.id && a.id === sess.usuario.id;
                        return (
                          <option key={a.id} value={a.id}>
                            {soyYo ? '👤 (Tú) ' : ''}
                            {a.nombres} {a.apellidos}
                            {a.correo ? ` · ${a.correo}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {errors.asesorId && <div className="invalid-feedback d-block small">{errors.asesorId}</div>}
                    {sess?.usuario?.id && (
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1">
                        <i className="bi bi-info-circle text-info" />
                        Por defecto está <b>seleccionado tu cuenta</b> como asesor asignado.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold">ID del asesor *</label>
                      <input className={`form-control ${errors.asesorId ? 'is-invalid' : ''}`} value={customAsesorForm.id} onChange={(e) => setCustomAsesorForm((f) => ({ ...f, id: e.target.value }))} placeholder="ID del asesor" />
                      {errors.asesorId && <div className="invalid-feedback d-block small">{errors.asesorId}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Nombres *</label>
                      <input className={`form-control ${errors.asesorNombre ? 'is-invalid' : ''}`} value={customAsesorForm.nombres} onChange={(e) => setCustomAsesorForm((f) => ({ ...f, nombres: e.target.value }))} />
                      {errors.asesorNombre && <div className="invalid-feedback d-block small">{errors.asesorNombre}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Apellidos</label>
                      <input className="form-control" value={customAsesorForm.apellidos} onChange={(e) => setCustomAsesorForm((f) => ({ ...f, apellidos: e.target.value }))} />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-semibold">Correo</label>
                      <input type="email" className="form-control" value={customAsesorForm.correo} onChange={(e) => setCustomAsesorForm((f) => ({ ...f, correo: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Etapa</label>
                <select className="form-select" value={form.etapa} onChange={(e) => setField('etapa', e.target.value as EtapaPipeline)}>
                  {ETAPAS_PIPELINE.map((et) => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Prioridad</label>
                <select className="form-select" value={form.prioridad} onChange={(e) => setField('prioridad', e.target.value as PrioridadPipeline)}>
                  {PRIORIDADES_PIPELINE.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold">Probabilidad cierre (%) {form.probabilidadCierre}</label>
                <input
                  type="range"
                  className={`form-range ${errors.probabilidadCierre ? 'is-invalid' : ''}`}
                  min={0}
                  max={100}
                  step={5}
                  value={form.probabilidadCierre ?? 0}
                  onChange={(e) => setField('probabilidadCierre', parseInt(e.target.value, 10))}
                />
                {errors.probabilidadCierre && <div className="invalid-feedback d-block small">{errors.probabilidadCierre}</div>}
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Fecha ingreso</label>
                <input type="datetime-local" className="form-control" value={toInputLocal(form.fechaIngreso)} onChange={(e) => setField('fechaIngreso', toISO(e.target.value))} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Último seguimiento</label>
                <input type="datetime-local" className="form-control" value={toInputLocal(form.fechaUltimoSeguimiento)} onChange={(e) => setField('fechaUltimoSeguimiento', toISO(e.target.value) || null)} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold">Próximo seguimiento</label>
                <input type="datetime-local" className="form-control" value={toInputLocal(form.proximaFechaSeguimiento)} onChange={(e) => setField('proximaFechaSeguimiento', toISO(e.target.value) || null)} />
              </div>

              <div className="col-12">
                <label className="form-label small fw-semibold">Motivo de pérdida</label>
                <input className="form-control" maxLength={255} value={form.motivoPerdida || ''} onChange={(e) => setField('motivoPerdida', e.target.value || null)} placeholder="Ej. No califica para crédito." />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Observaciones</label>
                <textarea className="form-control" rows={3} value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} placeholder="Información adicional del trato" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear oportunidad' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
