'use client';

import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { formatPEN, getSession } from '@/lib/api';
import { http } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  CONTRATO_BADGE,
  Contrato,
  CreateContratoInput,
  ESTADOS_CONTRATO,
  EstadoContrato,
  PropiedadLight,
  ResponsableLight,
  TIPOS_CONTRATO,
  TipoContrato,
  UpdateContratoInput,
  VentaLight,
} from '@/lib/contratos-comisiones';

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

export default function ContratoModal({
  open,
  mode,
  initial,
  clientes,
  asesores,
  propiedades,
  ventas,
  onRefAdd,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: Contrato | null;
  clientes: ClienteLight[];
  asesores: ResponsableLight[];
  propiedades: PropiedadLight[];
  ventas: VentaLight[];
  onRefAdd: (kind: 'cliente' | 'asesor' | 'propiedad' | 'responsable' | 'venta', ref: any) => void;
  onClose: () => void;
  onSaved: (c: Contrato, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const [form, setForm] = useState<CreateContratoInput>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [cv, setCv] = useState(ventas.length === 0);
  const [cvForm, setCvForm] = useState({ id: '' });
  const [cc, setCc] = useState(clientes.length === 0);
  const [ccForm, setCcForm] = useState({ id: '', nombres: '', apellidos: '', correo: '', celular: '' });
  const [ca, setCa] = useState(asesores.length === 0);
  const [caForm, setCaForm] = useState({ id: sess?.usuario.id || '', nombres: sess?.usuario.nombres || '', apellidos: sess?.usuario.apellidos || '', correo: sess?.usuario.correo || '' });
  const [cp, setCp] = useState(propiedades.length === 0);
  const [cpForm, setCpForm] = useState({ id: '', codigoInterno: '', nombre: '' });
  const [cr, setCr] = useState(asesores.length === 0);
  const [crForm, setCrForm] = useState({ id: sess?.usuario.id || '', nombres: sess?.usuario.nombres || '', apellidos: sess?.usuario.apellidos || '', correo: sess?.usuario.correo || '' });

  function nextNum(): string {
    const y = new Date().getFullYear();
    const r = Math.floor(Math.random() * 9000 + 1000);
    return `CTR-${y}-${r}`;
  }

  function empty(): CreateContratoInput {
    const now = new Date();
    const vence = new Date();
    vence.setDate(vence.getDate() + 30);
    return {
      numeroContrato: nextNum(),
      version: 1,
      ventaId: ventas[0]?.id || '',
      clienteId: clientes[0]?.id || '',
      propiedadId: propiedades[0]?.id || '',
      responsableId: asesores[0]?.id || sess?.usuario.id || '',
      fechaEmision: now.toISOString(),
      fechaFirma: null,
      fechaVencimiento: vence.toISOString(),
      estado: 'PENDIENTE_FIRMA',
      tipo: 'COMPRAVENTA',
      montoContrato: 0,
      observaciones: null,
      rutaPdfFirmado: null,
      hashDocumento: null,
    };
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!modalRef.current) return;
    const B = (window as any).bootstrap;
    if (!bsRef.current && B?.Modal) {
      bsRef.current = new B.Modal(modalRef.current, { backdrop: 'static', keyboard: false });
    }
    if (bsRef.current) {
      if (open) { reset(); bsRef.current.show(); }
      else bsRef.current.hide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    if (initial) {
      setForm({
        numeroContrato: initial.numeroContrato,
        version: initial.version,
        ventaId: initial.ventaId,
        clienteId: initial.clienteId,
        propiedadId: initial.propiedadId,
        responsableId: initial.responsableId,
        fechaEmision: initial.fechaEmision,
        fechaFirma: initial.fechaFirma,
        fechaVencimiento: initial.fechaVencimiento,
        estado: initial.estado,
        tipo: initial.tipo,
        montoContrato: parseFloat(initial.montoContrato || '0'),
        observaciones: initial.observaciones,
        rutaPdfFirmado: initial.rutaPdfFirmado,
        hashDocumento: initial.hashDocumento,
      });
      setCv(!ventas.find((v) => v.id === initial.ventaId)); setCvForm({ id: initial.ventaId });
      setCc(!clientes.find((c) => c.id === initial.clienteId));
      setCcForm({ id: initial.clienteId, nombres: initial.cliente.nombres, apellidos: initial.cliente.apellidos, correo: initial.cliente.correo || '', celular: initial.cliente.celular || '' });
      setCa(!asesores.find((a) => a.id === initial.responsableId));
      setCaForm({ id: initial.responsableId, nombres: initial.responsable.nombres, apellidos: initial.responsable.apellidos, correo: initial.responsable.correo || '' });
      setCr(setCa as any); // same select
      setCrForm({ id: initial.responsableId, nombres: initial.responsable.nombres, apellidos: initial.responsable.apellidos, correo: initial.responsable.correo || '' });
      setCp(!propiedades.find((p) => p.id === initial.propiedadId));
      setCpForm({ id: initial.propiedadId, codigoInterno: initial.propiedad.codigoInterno, nombre: initial.propiedad.nombre });
    } else {
      setForm(empty());
      setCv(ventas.length === 0);
      setCc(clientes.length === 0);
      setCa(asesores.length === 0);
      setCr(asesores.length === 0);
      setCp(propiedades.length === 0);
    }
    setErrors({});
    setGlobalErr(null);
  }

  function setField<K extends keyof CreateContratoInput>(k: K, v: CreateContratoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.numeroContrato?.trim()) e.numeroContrato = 'Número requerido.';
    if (!form.tipo) e.tipo = 'Tipo requerido.';
    if (!form.montoContrato || Number(form.montoContrato) <= 0) e.montoContrato = 'Monto > 0 requerido.';
    if (cv && !cvForm.id.trim()) e.ventaId = 'ID venta requerido.';
    if (!cv && !form.ventaId) e.ventaId = 'Selecciona venta.';
    if (cc) {
      if (!ccForm.id.trim()) e.clienteId = 'ID cliente requerido.';
      if (!ccForm.nombres.trim()) e.clienteNombre = 'Nombre cliente requerido.';
    } else if (!form.clienteId) e.clienteId = 'Selecciona cliente.';
    if (cp) {
      if (!cpForm.id.trim()) e.propiedadId = 'ID propiedad requerido.';
      if (!cpForm.nombre.trim()) e.propiedadNombre = 'Nombre propiedad requerido.';
    } else if (!form.propiedadId) e.propiedadId = 'Selecciona propiedad.';
    if (cr) {
      if (!crForm.id.trim()) e.responsableId = 'ID responsable requerido.';
      if (!crForm.nombres.trim()) e.responsableNombre = 'Nombre responsable requerido.';
    } else if (!form.responsableId) e.responsableId = 'Selecciona responsable.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sess) return;
    if (!validate()) return;
    setSaving(true);
    setGlobalErr(null);
    if (cv && cvForm.id.trim()) onRefAdd('venta', { id: cvForm.id.trim(), estado: 'FORMALIZADA', fechaVenta: form.fechaEmision || new Date().toISOString(), totalVenta: String(form.montoContrato), saldoPendiente: '0' });
    if (cc) onRefAdd('cliente', { id: ccForm.id.trim(), nombres: ccForm.nombres.trim(), apellidos: ccForm.apellidos.trim(), correo: ccForm.correo.trim() || null, celular: ccForm.celular.trim() || null });
    if (cp) onRefAdd('propiedad', { id: cpForm.id.trim(), codigoInterno: cpForm.codigoInterno.trim() || cpForm.id.trim(), nombre: cpForm.nombre.trim(), estado: 'VENDIDO', proyecto: null });
    if (cr) onRefAdd('responsable', { id: crForm.id.trim(), nombres: crForm.nombres.trim(), apellidos: crForm.apellidos.trim(), correo: crForm.correo.trim() || null });

    const payload: CreateContratoInput = {
      ...form,
      ventaId: cv ? cvForm.id.trim() : form.ventaId,
      clienteId: cc ? ccForm.id.trim() : form.clienteId,
      propiedadId: cp ? cpForm.id.trim() : form.propiedadId,
      responsableId: cr ? crForm.id.trim() : form.responsableId,
      fechaEmision: form.fechaEmision ? toIso(toLocal(form.fechaEmision)) : null,
      fechaFirma: form.fechaFirma ? toIso(toLocal(form.fechaFirma)) : null,
      fechaVencimiento: form.fechaVencimiento ? toIso(toLocal(form.fechaVencimiento)) : null,
      montoContrato: Number(form.montoContrato ?? 0),
      version: Number(form.version ?? 1),
      rutaPdfFirmado: form.rutaPdfFirmado?.trim() || null,
      hashDocumento: form.hashDocumento?.trim() || null,
      observaciones: form.observaciones?.trim() || null,
    };

    try {
      const url = `/empresas/${sess.usuario.empresaId}/contratos` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const body: CreateContratoInput | UpdateContratoInput = payload;
      const { data } = await method<Contrato>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar el contrato.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nuevo contrato' : `Editar contrato ${initial?.numeroContrato || ''}`;
  const versionNumber = Number(form.version ?? 1);

  return (
    <div className="modal fade" id="contratoModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={modalRef}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="contratoModalLabel">
              <i className="bi bi-file-earmark-richtext me-2 text-primary" />{title}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && <div className="alert alert-danger small py-2 d-flex align-items-center gap-2" role="alert"><i className="bi bi-exclamation-triangle-fill" /><div>{globalErr}</div></div>}
            {mode === 'edit' && (
              <div className="alert alert-warning small py-2 mb-3 d-flex align-items-center gap-2" role="alert">
                <i className="bi bi-info-circle" />
                <div>No se permite modificar la venta, cliente ni propiedad de un contrato existente.</div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Número contrato *</label>
                <input className={`form-control ${errors.numeroContrato ? 'is-invalid' : ''}`} maxLength={50} value={form.numeroContrato} onChange={(e) => setField('numeroContrato', e.target.value)} disabled={mode === 'edit'} />
                {errors.numeroContrato && <div className="invalid-feedback d-block small">{errors.numeroContrato}</div>}
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Versión</label>
                <input type="number" className="form-control" min={1} step={1} value={versionNumber} onChange={(e) => setField('version', e.target.value ? parseInt(e.target.value, 10) : 1)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Tipo *</label>
                <select className={`form-select ${errors.tipo ? 'is-invalid' : ''}`} value={form.tipo} onChange={(e) => setField('tipo', e.target.value as TipoContrato)}>
                  {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.tipo && <div className="invalid-feedback d-block small">{errors.tipo}</div>}
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Estado</label>
                <select className="form-select" value={form.estado} onChange={(e) => setField('estado', e.target.value as EstadoContrato)}>
                  {ESTADOS_CONTRATO.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="col-md-4">
                <RbGroup name="rbCV" a={!cv} b={cv} onA={() => setCv(false)} onB={() => setCv(true)} labels={['Seleccionar venta', 'Referenciar por ID']} />
                {!cv ? (
                  <select className={`form-select ${errors.ventaId ? 'is-invalid' : ''}`} value={form.ventaId} disabled={mode === 'edit'} onChange={(e) => setField('ventaId', e.target.value)}>
                    {ventas.length === 0 && <option value="">Sin ventas — activa opción manual</option>}
                    {ventas.map((v) => <option key={v.id} value={v.id}>{v.id.slice(0, 10)}… · {formatPEN(v.totalVenta)} · {v.estado.replace(/_/g, ' ')}</option>)}
                  </select>
                ) : (
                  <input placeholder="ID venta *" disabled={mode === 'edit'} className={`form-control ${errors.ventaId ? 'is-invalid' : ''}`} value={cvForm.id} onChange={(e) => setCvForm((f) => ({ ...f, id: e.target.value }))} />
                )}
                {errors.ventaId && <div className="invalid-feedback d-block small">{errors.ventaId}</div>}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbCC" a={!cc} b={cc} onA={() => setCc(false)} onB={() => setCc(true)} labels={['Seleccionar cliente', 'Referenciar por ID']} />
                {!cc ? (
                  <select className={`form-select ${errors.clienteId ? 'is-invalid' : ''}`} value={form.clienteId} disabled={mode === 'edit'} onChange={(e) => setField('clienteId', e.target.value)}>
                    {clientes.length === 0 && <option value="">Sin clientes — activa opción manual</option>}
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}{c.correo ? ` · ${c.correo}` : ''}</option>)}
                  </select>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12"><input placeholder="ID cliente *" disabled={mode === 'edit'} className={`form-control ${errors.clienteId ? 'is-invalid' : ''}`} value={ccForm.id} onChange={(e) => setCcForm((f) => ({ ...f, id: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombres *" disabled={mode === 'edit'} className={`form-control ${errors.clienteNombre ? 'is-invalid' : ''}`} value={ccForm.nombres} onChange={(e) => setCcForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" disabled={mode === 'edit'} className="form-control" value={ccForm.apellidos} onChange={(e) => setCcForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Correo" disabled={mode === 'edit'} type="email" className="form-control" value={ccForm.correo} onChange={(e) => setCcForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Celular" disabled={mode === 'edit'} className="form-control" value={ccForm.celular} onChange={(e) => setCcForm((f) => ({ ...f, celular: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.clienteId || errors.clienteNombre) && <div className="invalid-feedback d-block small">{errors.clienteId || errors.clienteNombre}</div>}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbCP" a={!cp} b={cp} onA={() => setCp(false)} onB={() => setCp(true)} labels={['Seleccionar propiedad', 'Referenciar por ID']} />
                {!cp ? (
                  <select className={`form-select ${errors.propiedadId ? 'is-invalid' : ''}`} value={form.propiedadId} disabled={mode === 'edit'} onChange={(e) => setField('propiedadId', e.target.value)}>
                    {propiedades.length === 0 && <option value="">Sin propiedades — activa opción manual</option>}
                    {propiedades.map((p) => <option key={p.id} value={p.id}>[{p.codigoInterno}] {p.nombre}</option>)}
                  </select>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12"><input placeholder="ID propiedad *" disabled={mode === 'edit'} className={`form-control ${errors.propiedadId ? 'is-invalid' : ''}`} value={cpForm.id} onChange={(e) => setCpForm((f) => ({ ...f, id: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Código interno" disabled={mode === 'edit'} className="form-control" value={cpForm.codigoInterno} onChange={(e) => setCpForm((f) => ({ ...f, codigoInterno: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombre *" disabled={mode === 'edit'} className={`form-control ${errors.propiedadNombre ? 'is-invalid' : ''}`} value={cpForm.nombre} onChange={(e) => setCpForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.propiedadId || errors.propiedadNombre) && <div className="invalid-feedback d-block small">{errors.propiedadId || errors.propiedadNombre}</div>}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbCR" a={!cr} b={cr} onA={() => setCr(false)} onB={() => setCr(true)} labels={['Seleccionar responsable', 'Referenciar por ID']} />
                {!cr ? (
                  <select className={`form-select ${errors.responsableId ? 'is-invalid' : ''}`} value={form.responsableId} onChange={(e) => setField('responsableId', e.target.value)}>
                    {asesores.length === 0 && <option value="">Sin responsables — activa opción manual</option>}
                    {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}{a.correo ? ` · ${a.correo}` : ''}</option>)}
                  </select>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12"><input placeholder="ID responsable *" className={`form-control ${errors.responsableId ? 'is-invalid' : ''}`} value={crForm.id} onChange={(e) => setCrForm((f) => ({ ...f, id: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombres *" className={`form-control ${errors.responsableNombre ? 'is-invalid' : ''}`} value={crForm.nombres} onChange={(e) => setCrForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" className="form-control" value={crForm.apellidos} onChange={(e) => setCrForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-12"><input placeholder="Correo" type="email" className="form-control" value={crForm.correo} onChange={(e) => setCrForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.responsableId || errors.responsableNombre) && <div className="invalid-feedback d-block small">{errors.responsableId || errors.responsableNombre}</div>}
              </div>

              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha emisión</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaEmision)} onChange={(e) => setField('fechaEmision', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha firma</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaFirma)} onChange={(e) => setField('fechaFirma', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha vencimiento</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaVencimiento)} onChange={(e) => setField('fechaVencimiento', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Monto contrato *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.montoContrato ? 'is-invalid' : ''}`} min={0.01} step={0.01} value={form.montoContrato} onChange={(e) => setField('montoContrato', e.target.value ? parseFloat(e.target.value) : 0)} />
                  {errors.montoContrato && <div className="invalid-feedback d-block small">{errors.montoContrato}</div>}
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold">Ruta PDF firmado</label>
                <input className="form-control" maxLength={500} value={form.rutaPdfFirmado || ''} onChange={(e) => setField('rutaPdfFirmado', e.target.value || null)} placeholder="/uploads/contratos/ctr-2026-0001.pdf" />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Hash documento (sha256)</label>
                <input className="form-control" maxLength={128} value={form.hashDocumento || ''} onChange={(e) => setField('hashDocumento', e.target.value || null)} placeholder="sha256-hash-del-documento" />
              </div>

              <div className="col-12">
                <label className="form-label small fw-semibold">Observaciones</label>
                <textarea className="form-control" rows={2} value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear contrato' : 'Guardar cambios'}
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
