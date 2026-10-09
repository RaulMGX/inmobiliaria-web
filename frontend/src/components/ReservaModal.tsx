'use client';

import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { getSession, http, initials } from '@/lib/api';
import { useBindBootstrapModal } from '@/lib/bootstrap-modal';
import {
  AsesorLight,
  ClienteLight,
  CreateReservaInput,
  ESTADOS_RESERVA,
  EstadoReserva,
  PropiedadLight,
  Reserva,
  UpdateReservaInput,
} from '@/lib/visitas-reservas';

type Mode = 'create' | 'edit';

function toLocal(d: string | null | undefined) {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function toIso(v: string): string {
  if (!v) return '';
  return new Date(v).toISOString();
}

export default function ReservaModal({
  open,
  mode,
  initial,
  clientes,
  asesores,
  propiedades,
  onRefAdd,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: Reserva | null;
  clientes: ClienteLight[];
  asesores: AsesorLight[];
  propiedades: PropiedadLight[];
  onRefAdd: (kind: 'cliente' | 'asesor' | 'propiedad', ref: any) => void;
  onClose: () => void;
  onSaved: (r: Reserva, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const [form, setForm] = useState<CreateReservaInput>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cc, setCc] = useState(clientes.length === 0);
  const [ccForm, setCcForm] = useState({ id: '', nombres: '', apellidos: '', correo: '', celular: '' });
  const [ca, setCa] = useState(asesores.length === 0);
  const [caForm, setCaForm] = useState({ id: sess?.usuario.id || '', nombres: sess?.usuario.nombres || '', apellidos: sess?.usuario.apellidos || '', correo: sess?.usuario.correo || '' });
  const [cp, setCp] = useState(propiedades.length === 0);
  const [cpForm, setCpForm] = useState({ id: '', codigoInterno: '', nombre: '' });
  const [looking, setLooking] = useState<{ cc: boolean; ca: boolean; cp: boolean }>({ cc: false, ca: false, cp: false });
  const debCc = useRef<number | undefined>(undefined);
  const debCa = useRef<number | undefined>(undefined);
  const debCp = useRef<number | undefined>(undefined);

  function empty(): CreateReservaInput {
    const now = new Date();
    const venc = new Date();
    venc.setDate(venc.getDate() + 7);
    const yo = sess?.usuario;
    const asesorActual =
      asesores.find((a) => a.id === yo?.id) ??
      (yo ? ({ id: yo.id, nombres: yo.nombres || '', apellidos: yo.apellidos || '', correo: yo.correo || null } as AsesorLight) : null);
    return {
      clienteId: clientes[0]?.id || '',
      propiedadId: propiedades[0]?.id || '',
      asesorId: asesorActual?.id || asesores[0]?.id || yo?.id || '',
      pipelineId: null,
      visitaId: null,
      montoSeparacion: 0,
      fechaReserva: now.toISOString(),
      fechaVencimiento: venc.toISOString(),
      estado: 'ACTIVA',
      observaciones: null,
    };
  }

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, mode]);

  useEffect(() => {
    if (mode !== 'create' || initial) return;
    if (cc && clientes.length > 0) {
      setCc(false);
      setForm((f) => ({ ...f, clienteId: clientes[0]?.id || f.clienteId }));
    }
    const yo = sess?.usuario;
    const tieneYo = asesores.some((a) => a.id === yo?.id);
    if (ca && (asesores.length > 0 || yo)) {
      setCa(false);
      const pickId = tieneYo ? yo!.id : asesores[0]?.id || yo?.id || '';
      setForm((f) => ({ ...f, asesorId: pickId || f.asesorId }));
    }
    if (cp && propiedades.length > 0) {
      setCp(false);
      setForm((f) => ({ ...f, propiedadId: propiedades[0]?.id || f.propiedadId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes.length, asesores.length, propiedades.length, open]);

  /* Lookup Cliente */
  useEffect(() => {
    if (!cc) return;
    const id = ccForm.id.trim();
    if (!id) return;
    if (debCc.current) window.clearTimeout(debCc.current);
    debCc.current = window.setTimeout(async () => {
      const local = clientes.find((c) => c.id === id);
      if (local) { setCcForm({ id, nombres: local.nombres, apellidos: local.apellidos, correo: local.correo || '', celular: local.celular || '' }); return; }
      if (!sess?.usuario.empresaId) return;
      setLooking((l) => ({ ...l, cc: true }));
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/clientes/${encodeURIComponent(id)}`);
        const c = data?.data ?? data;
        if (c?.id) {
          setCcForm({ id: c.id, nombres: c.nombres || '', apellidos: c.apellidos || '', correo: c.correo || '', celular: c.celular || '' });
          if (typeof onRefAdd === 'function') onRefAdd('cliente', { id: c.id, nombres: c.nombres || '', apellidos: c.apellidos || '', correo: c.correo || null, celular: c.celular || null });
        }
      } catch { /* ignore */ } finally { setLooking((l) => ({ ...l, cc: false })); }
    }, 450);
    return () => { if (debCc.current) window.clearTimeout(debCc.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccForm.id, cc, clientes]);

  /* Lookup Asesor */
  useEffect(() => {
    if (!ca) return;
    const id = caForm.id.trim();
    if (!id) return;
    if (debCa.current) window.clearTimeout(debCa.current);
    debCa.current = window.setTimeout(async () => {
      const local = asesores.find((a) => a.id === id);
      if (local) { setCaForm({ id, nombres: local.nombres, apellidos: local.apellidos, correo: local.correo || '' }); return; }
      if (!sess?.usuario.empresaId) return;
      setLooking((l) => ({ ...l, ca: true }));
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/usuarios/${encodeURIComponent(id)}`);
        const u = data?.data ?? data;
        if (u?.id) {
          setCaForm({ id: u.id, nombres: u.nombres || '', apellidos: u.apellidos || '', correo: u.correo || '' });
          if (typeof onRefAdd === 'function') onRefAdd('asesor', { id: u.id, nombres: u.nombres || '', apellidos: u.apellidos || '', correo: u.correo || null });
        }
      } catch { /* ignore */ } finally { setLooking((l) => ({ ...l, ca: false })); }
    }, 450);
    return () => { if (debCa.current) window.clearTimeout(debCa.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caForm.id, ca, asesores]);

  /* Lookup Propiedad */
  useEffect(() => {
    if (!cp) return;
    const id = cpForm.id.trim();
    if (!id) return;
    if (debCp.current) window.clearTimeout(debCp.current);
    debCp.current = window.setTimeout(async () => {
      const local = propiedades.find((p) => p.id === id);
      if (local) { setCpForm({ id, codigoInterno: local.codigoInterno || '', nombre: local.nombre || '' }); return; }
      if (!sess?.usuario.empresaId) return;
      setLooking((l) => ({ ...l, cp: true }));
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/propiedades/${encodeURIComponent(id)}`);
        const p = data?.data ?? data;
        if (p?.id) {
          setCpForm({ id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id });
          if (typeof onRefAdd === 'function') onRefAdd('propiedad', { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null });
        }
      } catch { /* ignore */ } finally { setLooking((l) => ({ ...l, cp: false })); }
    }, 450);
    return () => { if (debCp.current) window.clearTimeout(debCp.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpForm.id, cp, propiedades]);

  useBindBootstrapModal(modalRef, bsRef, open, undefined, { backdrop: 'static', keyboard: false });

  function reset() {
    if (initial) {
      setForm({
        clienteId: initial.clienteId,
        propiedadId: initial.propiedadId,
        asesorId: initial.asesorId,
        pipelineId: initial.pipelineId,
        visitaId: initial.visitaId,
        montoSeparacion: parseFloat(initial.montoSeparacion || '0'),
        fechaReserva: initial.fechaReserva,
        fechaVencimiento: initial.fechaVencimiento,
        estado: initial.estado,
        observaciones: initial.observaciones,
      });
      setCc(!clientes.find((c) => c.id === initial.clienteId));
      setCcForm({ id: initial.clienteId, nombres: initial.cliente.nombres, apellidos: initial.cliente.apellidos, correo: initial.cliente.correo || '', celular: initial.cliente.celular || '' });
      setCa(!asesores.find((a) => a.id === initial.asesorId));
      setCaForm({ id: initial.asesorId, nombres: initial.asesor.nombres, apellidos: initial.asesor.apellidos, correo: initial.asesor.correo || '' });
      setCp(!propiedades.find((p) => p.id === initial.propiedadId));
      setCpForm({ id: initial.propiedadId, codigoInterno: initial.propiedad.codigoInterno, nombre: initial.propiedad.nombre });
    } else {
      setForm(empty());
      setCc(clientes.length === 0);
      setCa(asesores.length === 0);
      setCp(propiedades.length === 0);
    }
    setErrors({});
    setGlobalErr(null);
  }

  function setField<K extends keyof CreateReservaInput>(k: K, v: CreateReservaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fechaVencimiento) e.fechaVencimiento = 'Fecha de vencimiento requerida.';
    if (form.montoSeparacion == null || isNaN(Number(form.montoSeparacion)) || Number(form.montoSeparacion) < 0) e.montoSeparacion = 'Monto válido requerido.';
    if (cc) {
      if (!ccForm.id.trim()) e.clienteId = 'ID cliente requerido.';
      if (!ccForm.nombres.trim()) e.clienteNombre = 'Nombre cliente requerido.';
    } else if (!form.clienteId) e.clienteId = 'Selecciona cliente.';
    if (ca) {
      if (!caForm.id.trim()) e.asesorId = 'ID asesor requerido.';
      if (!caForm.nombres.trim()) e.asesorNombre = 'Nombre asesor requerido.';
    } else if (!form.asesorId) e.asesorId = 'Selecciona asesor.';
    if (cp) {
      if (!cpForm.id.trim()) e.propiedadId = 'ID propiedad requerido.';
      if (!cpForm.nombre.trim()) e.propiedadNombre = 'Nombre propiedad requerido.';
    } else if (!form.propiedadId) e.propiedadId = 'Selecciona propiedad.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sess) return;
    if (!validate()) return;
    setSaving(true);
    setGlobalErr(null);
    if (cc) onRefAdd('cliente', { id: ccForm.id.trim(), nombres: ccForm.nombres.trim(), apellidos: ccForm.apellidos.trim(), correo: ccForm.correo.trim() || null, celular: ccForm.celular.trim() || null });
    if (ca) onRefAdd('asesor', { id: caForm.id.trim(), nombres: caForm.nombres.trim(), apellidos: caForm.apellidos.trim(), correo: caForm.correo.trim() || null });
    if (cp) onRefAdd('propiedad', { id: cpForm.id.trim(), codigoInterno: cpForm.codigoInterno.trim() || cpForm.id.trim(), nombre: cpForm.nombre.trim(), estado: 'DISPONIBLE', proyecto: null });

    const payload: CreateReservaInput = {
      ...form,
      fechaReserva: form.fechaReserva ? toIso(toLocal(form.fechaReserva) || new Date().toISOString()) : null,
      fechaVencimiento: toIso(toLocal(form.fechaVencimiento) || new Date().toISOString()),
      clienteId: cc ? ccForm.id.trim() : form.clienteId,
      asesorId: ca ? caForm.id.trim() : form.asesorId,
      propiedadId: cp ? cpForm.id.trim() : form.propiedadId,
    };

    try {
      const url = `/empresas/${sess.usuario.empresaId}/reservas` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const body: CreateReservaInput | UpdateReservaInput = payload;
      const { data } = await method<Reserva>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar la reserva.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nueva reserva' : `Editar reserva ${initial?.id.slice(0, 8) || ''}`;

  return (
    <div className="modal fade" id="reservaModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={modalRef}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="reservaModalLabel">
              <i className="bi bi-receipt-cutoff me-2 text-success" />{title}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && <div className="alert alert-danger small py-2 d-flex align-items-center gap-2" role="alert"><i className="bi bi-exclamation-triangle-fill" /><div>{globalErr}</div></div>}
            <div className="row g-3">
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Fecha de reserva</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaReserva)} onChange={(e) => setField('fechaReserva', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Vence *</label>
                <input type="datetime-local" className={`form-control ${errors.fechaVencimiento ? 'is-invalid' : ''}`} value={toLocal(form.fechaVencimiento)} onChange={(e) => setField('fechaVencimiento', toIso(e.target.value))} />
                {errors.fechaVencimiento && <div className="invalid-feedback d-block small">{errors.fechaVencimiento}</div>}
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Monto (PEN) *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.montoSeparacion ? 'is-invalid' : ''}`} min={0} step={0.01} value={form.montoSeparacion} onChange={(e) => setField('montoSeparacion', e.target.value ? parseFloat(e.target.value) : 0)} />
                  {errors.montoSeparacion && <div className="invalid-feedback d-block small">{errors.montoSeparacion}</div>}
                </div>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-semibold">Estado</label>
                <select className="form-select" value={form.estado} onChange={(e) => setField('estado', e.target.value as EstadoReserva)}>
                  {ESTADOS_RESERVA.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="col-md-4">
                <RbGroup name="rbRCli" a={!cc} b={cc} onA={() => setCc(false)} onB={() => setCc(true)} labels={['Seleccionar cliente', 'Referenciar por ID']} />
                {!cc ? (
                  <div>
                    <label className="form-label small fw-semibold">Cliente *</label>
                    <select className={`form-select ${errors.clienteId ? 'is-invalid' : ''}`} value={form.clienteId} onChange={(e) => setField('clienteId', e.target.value)}>
                      <option value="">-- Selecciona un cliente --</option>
                      {clientes.length === 0 && <option value="" disabled>⚠️ No hay clientes cargados. Activa opción "Referenciar por ID".</option>}
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}{c.correo ? ` · ${c.correo}` : ''}{c.celular ? ` · ${c.celular}` : ''}</option>)}
                    </select>
                    {(errors.clienteId || errors.clienteNombre) && <div className="invalid-feedback d-block small">{errors.clienteId || errors.clienteNombre}</div>}
                  </div>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                        <span>ID cliente *</span>
                        {looking.cc && <span className="small text-info d-inline-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Buscando…</span>}
                      </label>
                      <input placeholder="Copia ID del cliente (botón 📋 en Clientes)" className={`form-control ${errors.clienteId ? 'is-invalid' : ''}`} value={ccForm.id} onChange={(e) => setCcForm((f) => ({ ...f, id: e.target.value }))} />
                      {(errors.clienteId || errors.clienteNombre) && <div className="invalid-feedback d-block small">{errors.clienteId || errors.clienteNombre}</div>}
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1">
                        <i className="bi bi-lightbulb text-warning" /> Al pegar el ID se autollenan Nombres/Apellidos/Correo/Celular.
                      </div>
                    </div>
                    <div className="col-6"><input placeholder="Nombres *" className={`form-control ${errors.clienteNombre ? 'is-invalid' : ''}`} value={ccForm.nombres} onChange={(e) => setCcForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" className="form-control" value={ccForm.apellidos} onChange={(e) => setCcForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Correo" type="email" className="form-control" value={ccForm.correo} onChange={(e) => setCcForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Celular" className="form-control" value={ccForm.celular} onChange={(e) => setCcForm((f) => ({ ...f, celular: e.target.value }))} /></div>
                  </div>
                )}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbRAs" a={!ca} b={ca} onA={() => setCa(false)} onB={() => setCa(true)} labels={['Seleccionar asesor', 'Referenciar por ID']} />
                {!ca ? (
                  <div>
                    <label className="form-label small fw-semibold">Asesor *</label>
                    <select className={`form-select ${errors.asesorId ? 'is-invalid' : ''}`} value={form.asesorId} onChange={(e) => setField('asesorId', e.target.value)}>
                      <option value="">-- Selecciona un asesor --</option>
                      {asesores.length === 0 && <option value="" disabled>⚠️ Sin asesores — activa opción manual</option>}
                      {asesores.map((a) => {
                        const soyYo = sess?.usuario?.id && a.id === sess.usuario.id;
                        return <option key={a.id} value={a.id}>{soyYo ? '👤 (Tú) ' : ''}{a.nombres} {a.apellidos}{a.correo ? ` · ${a.correo}` : ''}</option>;
                      })}
                    </select>
                    {(errors.asesorId || errors.asesorNombre) && <div className="invalid-feedback d-block small">{errors.asesorId || errors.asesorNombre}</div>}
                    {sess?.usuario?.id && (
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1"><i className="bi bi-info-circle text-info" /> Por defecto, tu cuenta como asesor asignado.</div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                        <span>ID asesor *</span>
                        {looking.ca && <span className="small text-info d-inline-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Buscando…</span>}
                      </label>
                      <input placeholder="ID asesor" className={`form-control ${errors.asesorId ? 'is-invalid' : ''}`} value={caForm.id} onChange={(e) => setCaForm((f) => ({ ...f, id: e.target.value }))} />
                      {(errors.asesorId || errors.asesorNombre) && <div className="invalid-feedback d-block small">{errors.asesorId || errors.asesorNombre}</div>}
                    </div>
                    <div className="col-6"><input placeholder="Nombres *" className={`form-control ${errors.asesorNombre ? 'is-invalid' : ''}`} value={caForm.nombres} onChange={(e) => setCaForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" className="form-control" value={caForm.apellidos} onChange={(e) => setCaForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-12"><input placeholder="Correo" type="email" className="form-control" value={caForm.correo} onChange={(e) => setCaForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                  </div>
                )}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbRPr" a={!cp} b={cp} onA={() => setCp(false)} onB={() => setCp(true)} labels={['Seleccionar propiedad', 'Referenciar por ID']} />
                {!cp ? (
                  <div>
                    <label className="form-label small fw-semibold">Propiedad *</label>
                    <select className={`form-select ${errors.propiedadId ? 'is-invalid' : ''}`} value={form.propiedadId} onChange={(e) => setField('propiedadId', e.target.value)}>
                      <option value="">-- Selecciona una propiedad --</option>
                      {propiedades.length === 0 && <option value="" disabled>⚠️ Sin propiedades — crea una o usa opción manual.</option>}
                      {propiedades.map((p) => <option key={p.id} value={p.id}>[{p.codigoInterno || 'SIN-COD'}] {p.nombre}</option>)}
                    </select>
                    {(errors.propiedadId || errors.propiedadNombre) && <div className="invalid-feedback d-block small">{errors.propiedadId || errors.propiedadNombre}</div>}
                  </div>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                        <span>ID propiedad *</span>
                        {looking.cp && <span className="small text-info d-inline-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Buscando…</span>}
                      </label>
                      <input placeholder="Copia ID desde Propiedades (botón 📋)" className={`form-control ${errors.propiedadId ? 'is-invalid' : ''}`} value={cpForm.id} onChange={(e) => setCpForm((f) => ({ ...f, id: e.target.value }))} />
                      {(errors.propiedadId || errors.propiedadNombre) && <div className="invalid-feedback d-block small">{errors.propiedadId || errors.propiedadNombre}</div>}
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1">
                        <i className="bi bi-lightbulb text-warning" /> Al pegar el ID se autollenan Código interno + Nombre.
                      </div>
                    </div>
                    <div className="col-6"><input placeholder="Código interno" className="form-control" value={cpForm.codigoInterno} onChange={(e) => setCpForm((f) => ({ ...f, codigoInterno: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombre *" className={`form-control ${errors.propiedadNombre ? 'is-invalid' : ''}`} value={cpForm.nombre} onChange={(e) => setCpForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold">Pipeline (ID opcional)</label>
                <input className="form-control" value={form.pipelineId || ''} onChange={(e) => setField('pipelineId', e.target.value || null)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Visita (ID opcional)</label>
                <input className="form-control" value={form.visitaId || ''} onChange={(e) => setField('visitaId', e.target.value || null)} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Observaciones</label>
                <textarea className="form-control" rows={3} value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} />
              </div>
              <div className="col-12">
                <div className="alert alert-light small py-2 mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle text-info" />
                  <div>IDs exactos son requeridos si usas la opción manual.</div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear reserva' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RbGroup({ name, a, b, onA, onB, labels }: { name: string; a: boolean; b: boolean; onA: () => void; onB: () => void; labels: [string, string] }) {
  return (
    <div className="d-flex gap-3 mb-2">
      <div className="form-check">
        <input className="form-check-input" type="radio" id={`${name}_A`} name={name} checked={a} onChange={onA} />
        <label className="form-check-label small" htmlFor={`${name}_A`}>{labels[0]}</label>
      </div>
      <div className="form-check">
        <input className="form-check-input" type="radio" id={`${name}_B`} name={name} checked={b} onChange={onB} />
        <label className="form-check-label small" htmlFor={`${name}_B`}>{labels[1]}</label>
      </div>
    </div>
  );
}
