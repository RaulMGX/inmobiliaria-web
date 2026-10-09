'use client';

import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { getSession, http, initials } from '@/lib/api';
import { useBindBootstrapModal } from '@/lib/bootstrap-modal';
import {
  AsesorLight,
  ClienteLight,
  CreateVisitaInput,
  ESTADOS_VISITA,
  EstadoVisita,
  PropiedadLight,
  UpdateVisitaInput,
  Visita,
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

export default function VisitaModal({
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
  initial: Visita | null;
  clientes: ClienteLight[];
  asesores: AsesorLight[];
  propiedades: PropiedadLight[];
  onRefAdd: (kind: 'cliente' | 'asesor' | 'propiedad', ref: any) => void;
  onClose: () => void;
  onSaved: (v: Visita, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';
  const [form, setForm] = useState<CreateVisitaInput>(empty());
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
  const [loadingRefs, setLoadingRefs] = useState(false);
  const debCc = useRef<number | undefined>(undefined);
  const debCa = useRef<number | undefined>(undefined);
  const debCp = useRef<number | undefined>(undefined);
  const refsFetchedRef = useRef(false);
  const localRefsRef = useRef({ clientes, asesores, propiedades });
  localRefsRef.current = { clientes, asesores, propiedades };

  function empty(): CreateVisitaInput {
    const yo = sess?.usuario;
    const asesorActual =
      asesores.find((a) => a.id === yo?.id) ??
      (yo ? ({ id: yo.id, nombres: yo.nombres || '', apellidos: yo.apellidos || '', correo: yo.correo || null } as AsesorLight) : null);
    return {
      fechaHora: new Date().toISOString(),
      duracionEstimada: 60,
      lugarEncuentro: null,
      estado: 'PROGRAMADA',
      resultado: null,
      observaciones: null,
      clienteId: clientes[0]?.id || '',
      asesorId: asesorActual?.id || asesores[0]?.id || yo?.id || '',
      propiedadId: propiedades[0]?.id || '',
      pipelineId: null,
      seguimientoId: null,
      reprogramadaDeId: null,
    };
  }

  useEffect(() => {
    if (!open || !empresaId) return;
    if (mode !== 'create') return;
    if (refsFetchedRef.current) return;
    const needCli = localRefsRef.current.clientes.length === 0;
    const needAs = localRefsRef.current.asesores.length === 0;
    const needPr = localRefsRef.current.propiedades.length === 0;
    if (!needCli && !needAs && !needPr) return;
    refsFetchedRef.current = true;
    (async () => {
      setLoadingRefs(true);
      try {
        const tasks: Promise<any>[] = [];
        if (needCli) tasks.push(http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }).then((r) => ({ tipo: 'cli', ok: true, r })).catch((e) => ({ tipo: 'cli', ok: false, e })));
        if (needAs) tasks.push(http.get<any>(`/empresas/${empresaId}/usuarios`, { params: { page: 1, limit: 100 } }).then((r) => ({ tipo: 'as', ok: true, r })).catch((e) => ({ tipo: 'as', ok: false, e })));
        if (needPr) tasks.push(http.get<any>(`/empresas/${empresaId}/propiedades`, { params: { page: 1, limit: 100 } }).then((r) => ({ tipo: 'pr', ok: true, r })).catch((e) => ({ tipo: 'pr', ok: false, e })));
        const results = await Promise.all(tasks);
        results.forEach((x: any) => {
          if (!x.ok) return;
          const arr = (x.r.data?.data ?? x.r.data ?? []) as any[];
          if (x.tipo === 'cli') {
            arr.forEach((c) => {
              onRefAdd('cliente', { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, estado: c.estado || 'NUEVO' });
            });
          } else if (x.tipo === 'as') {
            const yo = sess?.usuario;
            if (yo) onRefAdd('asesor', { id: yo.id, nombres: yo.nombres || '', apellidos: yo.apellidos || '', correo: yo.correo || null } as any);
            arr.forEach((u) => onRefAdd('asesor', { id: u.id, nombres: u.nombres || '', apellidos: u.apellidos || '', correo: u.correo || null }));
          } else if (x.tipo === 'pr') {
            arr.forEach((p) => onRefAdd('propiedad', { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null }));
          }
        });
      } catch (e) {
        setGlobalErr('No se pudieron cargar las listas de clientes/asesores/propiedades.');
      } finally {
        setLoadingRefs(false);
      }
    })();
  }, [open, empresaId, mode, sess, onRefAdd]);

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

  /* Lookup Cliente por ID manual debounce */
  useEffect(() => {
    if (!cc) return;
    const id = ccForm.id.trim();
    if (!id) return;
    if (debCc.current) window.clearTimeout(debCc.current);
    debCc.current = window.setTimeout(async () => {
      const local = clientes.find((c) => c.id === id);
      if (local) {
        setCcForm({ id, nombres: local.nombres, apellidos: local.apellidos, correo: local.correo || '', celular: local.celular || '' });
        return;
      }
      if (!sess?.usuario.empresaId) return;
      setLooking((l) => ({ ...l, cc: true }));
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/clientes/${encodeURIComponent(id)}`);
        const c = data?.data ?? data;
        if (c?.id) {
          setCcForm({ id: c.id, nombres: c.nombres || '', apellidos: c.apellidos || '', correo: c.correo || '', celular: c.celular || '' });
          if (typeof onRefAdd === 'function') onRefAdd('cliente', { id: c.id, nombres: c.nombres || '', apellidos: c.apellidos || '', correo: c.correo || null, celular: c.celular || null });
        }
      } catch {
        /* ignore */
      } finally {
        setLooking((l) => ({ ...l, cc: false }));
      }
    }, 450);
    return () => { if (debCc.current) window.clearTimeout(debCc.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccForm.id, cc, clientes]);

  /* Lookup Asesor por ID manual debounce */
  useEffect(() => {
    if (!ca) return;
    const id = caForm.id.trim();
    if (!id) return;
    if (debCa.current) window.clearTimeout(debCa.current);
    debCa.current = window.setTimeout(async () => {
      const local = asesores.find((a) => a.id === id);
      if (local) {
        setCaForm({ id, nombres: local.nombres, apellidos: local.apellidos, correo: local.correo || '' });
        return;
      }
      if (!sess?.usuario.empresaId) return;
      setLooking((l) => ({ ...l, ca: true }));
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/usuarios/${encodeURIComponent(id)}`);
        const u = data?.data ?? data;
        if (u?.id) {
          setCaForm({ id: u.id, nombres: u.nombres || '', apellidos: u.apellidos || '', correo: u.correo || '' });
          if (typeof onRefAdd === 'function') onRefAdd('asesor', { id: u.id, nombres: u.nombres || '', apellidos: u.apellidos || '', correo: u.correo || null });
        }
      } catch {
        /* ignore */
      } finally {
        setLooking((l) => ({ ...l, ca: false }));
      }
    }, 450);
    return () => { if (debCa.current) window.clearTimeout(debCa.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caForm.id, ca, asesores]);

  /* Lookup Propiedad por ID manual debounce */
  useEffect(() => {
    if (!cp) return;
    const id = cpForm.id.trim();
    if (!id) return;
    if (debCp.current) window.clearTimeout(debCp.current);
    debCp.current = window.setTimeout(async () => {
      const local = propiedades.find((p) => p.id === id);
      if (local) {
        setCpForm({ id, codigoInterno: local.codigoInterno || '', nombre: local.nombre || '' });
        return;
      }
      if (!sess?.usuario.empresaId) return;
      setLooking((l) => ({ ...l, cp: true }));
      try {
        const { data } = await http.get<any>(`/empresas/${sess.usuario.empresaId}/propiedades/${encodeURIComponent(id)}`);
        const p = data?.data ?? data;
        if (p?.id) {
          setCpForm({ id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id });
          if (typeof onRefAdd === 'function') onRefAdd('propiedad', { id: p.id, codigoInterno: p.codigoInterno || p.id, nombre: p.nombre || p.codigoInterno || p.id, estado: p.estado || 'DISPONIBLE', proyecto: p.proyecto || null });
        }
      } catch {
        /* ignore */
      } finally {
        setLooking((l) => ({ ...l, cp: false }));
      }
    }, 450);
    return () => { if (debCp.current) window.clearTimeout(debCp.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpForm.id, cp, propiedades]);

  useBindBootstrapModal(modalRef, bsRef, open, undefined, { backdrop: 'static', keyboard: false });

  function reset() {
    if (initial) {
      setForm({
        fechaHora: initial.fechaHora,
        duracionEstimada: initial.duracionEstimada,
        lugarEncuentro: initial.lugarEncuentro,
        estado: initial.estado,
        resultado: initial.resultado,
        observaciones: initial.observaciones,
        clienteId: initial.clienteId,
        asesorId: initial.asesorId,
        propiedadId: initial.propiedadId,
        pipelineId: initial.pipelineId,
        seguimientoId: initial.seguimientoId,
        reprogramadaDeId: initial.reprogramadaDeId,
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

  function setField<K extends keyof CreateVisitaInput>(k: K, v: CreateVisitaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fechaHora) e.fechaHora = 'Fecha/hora requerida.';
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

    const payload: CreateVisitaInput = {
      ...form,
      fechaHora: toIso(toLocal(form.fechaHora) || new Date().toISOString()),
      clienteId: cc ? ccForm.id.trim() : form.clienteId,
      asesorId: ca ? caForm.id.trim() : form.asesorId,
      propiedadId: cp ? cpForm.id.trim() : form.propiedadId,
    };

    try {
      const url = `/empresas/${sess.usuario.empresaId}/visitas` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const body: CreateVisitaInput | UpdateVisitaInput = payload;
      const { data } = await method<Visita>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar la visita.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nueva visita' : `Editar visita ${initial?.id.slice(0, 8) || ''}`;

  return (
    <div className="modal fade" id="visitaModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={modalRef}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="visitaModalLabel">
              <i className="bi bi-calendar-check me-2 text-primary" />{title}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && <div className="alert alert-danger small py-2 d-flex align-items-center gap-2" role="alert"><i className="bi bi-exclamation-triangle-fill" /><div>{globalErr}</div></div>}
            <div className="row g-3">
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Fecha y hora *</label>
                <input type="datetime-local" className={`form-control ${errors.fechaHora ? 'is-invalid' : ''}`} value={toLocal(form.fechaHora)} onChange={(e) => setField('fechaHora', toIso(e.target.value))} />
                {errors.fechaHora && <div className="invalid-feedback d-block small">{errors.fechaHora}</div>}
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Duración (min)</label>
                <input type="number" className="form-control" min={0} step={15} value={form.duracionEstimada ?? ''} onChange={(e) => setField('duracionEstimada', e.target.value ? parseInt(e.target.value, 10) : null)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-semibold">Estado</label>
                <select className="form-select" value={form.estado} onChange={(e) => setField('estado', e.target.value as EstadoVisita)}>
                  {ESTADOS_VISITA.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="col-md-4">
                <RbGroup name="rbCli" a={!cc} b={cc} onA={() => setCc(false)} onB={() => setCc(true)} labels={['Seleccionar cliente', 'Referenciar por ID']} />
                {!cc ? (
                  <div>
                    <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                      <span>Cliente *</span>
                      {loadingRefs && <span className="small text-info d-inline-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Cargando clientes…</span>}
                    </label>
                    <select className={`form-select ${errors.clienteId ? 'is-invalid' : ''}`} value={form.clienteId} onChange={(e) => setField('clienteId', e.target.value)}>
                      <option value="">-- Selecciona un cliente --</option>
                      {clientes.length === 0 && !loadingRefs && <option value="" disabled>⚠️ No hay clientes cargados. Pulsa [🔄 Recargar] o usa opción manual.</option>}
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}{c.correo ? ` · ${c.correo}` : ''}{c.celular ? ` · ${c.celular}` : ''}</option>)}
                    </select>
                    {clientes.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
                        onClick={() => { refsFetchedRef.current = false; setLoadingRefs(true); (async () => { try { const { data } = await http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }); (data?.data ?? data ?? []).forEach((c: any) => onRefAdd('cliente', { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, estado: c.estado || 'NUEVO' })); } finally { setLoadingRefs(false); }})(); }}
                      >
                        <i className="bi bi-arrow-clockwise" /> Recargar clientes
                      </button>
                    )}
                    {(errors.clienteId || errors.clienteNombre) && <div className="invalid-feedback d-block small">{errors.clienteId || errors.clienteNombre}</div>}
                  </div>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                        <span>ID cliente *</span>
                        {looking.cc && <span className="small text-info d-inline-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Buscando…</span>}
                      </label>
                      <input placeholder="Copia el ID del cliente desde Clientes (botón 📋)" className={`form-control ${errors.clienteId ? 'is-invalid' : ''}`} value={ccForm.id} onChange={(e) => setCcForm((f) => ({ ...f, id: e.target.value }))} />
                      {(errors.clienteId || errors.clienteNombre) && <div className="invalid-feedback d-block small">{errors.clienteId || errors.clienteNombre}</div>}
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1">
                        <i className="bi bi-lightbulb text-warning" />
                        Al pegar el ID se autocompletan Nombres/Apellidos/Correo/Celular.
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
                <RbGroup name="rbAs" a={!ca} b={ca} onA={() => setCa(false)} onB={() => setCa(true)} labels={['Seleccionar asesor', 'Referenciar por ID']} />
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
                <RbGroup name="rbPr" a={!cp} b={cp} onA={() => setCp(false)} onB={() => setCp(true)} labels={['Seleccionar propiedad', 'Referenciar por ID']} />
                {!cp ? (
                  <div>
                    <label className="form-label small fw-semibold">Propiedad *</label>
                    <select className={`form-select ${errors.propiedadId ? 'is-invalid' : ''}`} value={form.propiedadId} onChange={(e) => setField('propiedadId', e.target.value)}>
                      <option value="">-- Selecciona una propiedad --</option>
                      {propiedades.length === 0 && <option value="" disabled>⚠️ Sin propiedades — crea una en Módulo Propiedades o usa opción manual.</option>}
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
                        <i className="bi bi-lightbulb text-warning" /> Al pegar el ID se autocompletan Código interno + Nombre.
                      </div>
                    </div>
                    <div className="col-6"><input placeholder="Código interno" className="form-control" value={cpForm.codigoInterno} onChange={(e) => setCpForm((f) => ({ ...f, codigoInterno: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombre *" className={`form-control ${errors.propiedadNombre ? 'is-invalid' : ''}`} value={cpForm.nombre} onChange={(e) => setCpForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold">Lugar de encuentro</label>
                <input className="form-control" maxLength={255} value={form.lugarEncuentro || ''} onChange={(e) => setField('lugarEncuentro', e.target.value || null)} placeholder="Lobby del proyecto, local..." />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Reprogramada de (ID visita)</label>
                <input className="form-control" value={form.reprogramadaDeId || ''} onChange={(e) => setField('reprogramadaDeId', e.target.value || null)} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Resultado</label>
                <textarea className="form-control" rows={2} value={form.resultado || ''} onChange={(e) => setField('resultado', e.target.value || null)} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Observaciones</label>
                <textarea className="form-control" rows={2} value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} />
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear visita' : 'Guardar cambios'}
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
