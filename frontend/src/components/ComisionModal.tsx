'use client';

import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPEN, getSession } from '@/lib/api';
import { http } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  Comision,
  COMISION_BADGE,
  CreateComisionInput,
  ESTADOS_COMISION,
  EstadoComision,
  PropiedadLight,
  UpdateComisionInput,
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

export default function ComisionModal({
  open,
  mode,
  initial,
  asesores,
  ventas,
  onRefAdd,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: Comision | null;
  asesores: AsesorLight[];
  ventas: VentaLight[];
  onRefAdd: (kind: 'asesor' | 'venta', ref: any) => void;
  onClose: () => void;
  onSaved: (c: Comision, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const [form, setForm] = useState<CreateComisionInput>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cv, setCv] = useState(ventas.length === 0);
  const [cvForm, setCvForm] = useState({ id: '' });
  const [ca, setCa] = useState(asesores.length === 0);
  const [caForm, setCaForm] = useState({ id: sess?.usuario.id || '', nombres: sess?.usuario.nombres || '', apellidos: sess?.usuario.apellidos || '', correo: sess?.usuario.correo || '' });

  function empty(): CreateComisionInput {
    return {
      ventaId: ventas[0]?.id || '',
      asesorId: asesores[0]?.id || sess?.usuario.id || '',
      porcentajeComision: 0,
      montoComision: 0,
      estado: 'PENDIENTE',
      fechaGeneracion: new Date().toISOString(),
      fechaPago: null,
      observaciones: null,
    };
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!modalRef.current) return;
    const B = (window as any).bootstrap;
    if (!bsRef.current && B?.Modal) bsRef.current = new B.Modal(modalRef.current, { backdrop: 'static', keyboard: false });
    if (bsRef.current) { if (open) { reset(); bsRef.current.show(); } else bsRef.current.hide(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    if (initial) {
      setForm({
        ventaId: initial.ventaId,
        asesorId: initial.asesorId,
        porcentajeComision: parseFloat(initial.porcentajeComision || '0'),
        montoComision: parseFloat(initial.montoComision || '0'),
        estado: initial.estado,
        fechaGeneracion: initial.fechaGeneracion,
        fechaPago: initial.fechaPago,
        observaciones: initial.observaciones,
      });
      setCv(!ventas.find((v) => v.id === initial.ventaId)); setCvForm({ id: initial.ventaId });
      setCa(!asesores.find((a) => a.id === initial.asesorId));
      setCaForm({ id: initial.asesorId, nombres: initial.asesor.nombres, apellidos: initial.asesor.apellidos, correo: initial.asesor.correo || '' });
    } else {
      setForm(empty());
      setCv(ventas.length === 0);
      setCa(asesores.length === 0);
    }
    setErrors({});
    setGlobalErr(null);
  }

  function setField<K extends keyof CreateComisionInput>(k: K, v: CreateComisionInput[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      const total = selectedVentaAmount(next.ventaId);
      if (total > 0) {
        if (k === 'porcentajeComision') {
          const p = Number(next.porcentajeComision ?? 0);
          next.montoComision = Math.round((total * p) / 100 * 100) / 100;
        }
      }
      return next;
    });
  }

  function selectedVentaAmount(id: string): number {
    const v = ventas.find((x) => x.id === id);
    if (!v) return 0;
    return parseFloat(v.totalVenta || '0');
  }

  const totalVenta = useMemo(() => {
    if (initial && initial.ventaId === form.ventaId) return parseFloat(initial.venta.totalVenta || '0');
    return selectedVentaAmount(form.ventaId);
  }, [form.ventaId, initial, ventas]);

  const pct = Number(form.porcentajeComision ?? 0);
  const monto = Number(form.montoComision ?? 0);

  function validate() {
    const e: Record<string, string> = {};
    if (pct < 0 || pct > 100) e.porcentajeComision = '0-100% requerido.';
    if (monto < 0) e.montoComision = 'Monto ≥ 0 requerido.';
    if (cv && !cvForm.id.trim()) e.ventaId = 'ID venta requerido.';
    if (!cv && !form.ventaId) e.ventaId = 'Selecciona venta.';
    if (ca) {
      if (!caForm.id.trim()) e.asesorId = 'ID asesor requerido.';
      if (!caForm.nombres.trim()) e.asesorNombre = 'Nombre asesor requerido.';
    } else if (!form.asesorId) e.asesorId = 'Selecciona asesor.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sess) return;
    if (!validate()) return;
    setSaving(true);
    setGlobalErr(null);
    if (cv && cvForm.id.trim()) onRefAdd('venta', { id: cvForm.id.trim(), estado: 'FORMALIZADA', fechaVenta: new Date().toISOString(), totalVenta: '0', saldoPendiente: '0' });
    if (ca) onRefAdd('asesor', { id: caForm.id.trim(), nombres: caForm.nombres.trim(), apellidos: caForm.apellidos.trim(), correo: caForm.correo.trim() || null });

    const payload: CreateComisionInput = {
      ...form,
      ventaId: cv ? cvForm.id.trim() : form.ventaId,
      asesorId: ca ? caForm.id.trim() : form.asesorId,
      porcentajeComision: pct,
      montoComision: monto,
      fechaGeneracion: form.fechaGeneracion ? toIso(toLocal(form.fechaGeneracion)) : null,
      fechaPago: form.fechaPago ? toIso(toLocal(form.fechaPago)) : null,
      observaciones: form.observaciones?.trim() || null,
    };

    try {
      const url = `/empresas/${sess.usuario.empresaId}/comisiones` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const body: CreateComisionInput | UpdateComisionInput = payload;
      const { data } = await method<Comision>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar la comisión.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nueva comisión' : `Editar comisión ${initial?.id.slice(0, 8) || ''}`;

  return (
    <div className="modal fade" id="comisionModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={modalRef}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="comisionModalLabel"><i className="bi bi-wallet2 me-2 text-success" />{title}</h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && <div className="alert alert-danger small py-2 d-flex align-items-center gap-2" role="alert"><i className="bi bi-exclamation-triangle-fill" /><div>{globalErr}</div></div>}
            {mode === 'edit' && (
              <div className="alert alert-warning small py-2 mb-3 d-flex align-items-center gap-2" role="alert">
                <i className="bi bi-info-circle" />
                <div>No se permite cambiar la venta ni el asesor de una comisión existente.</div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-6">
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
                {totalVenta > 0 && (
                  <div className="mt-2 p-2 rounded border bg-light small">
                    <span className="text-muted">Total venta: </span>
                    <span className="fw-semibold">{formatPEN(totalVenta)}</span>
                    <span className="text-muted ms-2">Sugerido: </span>
                    <span className="fw-semibold">{formatPEN(Math.round(totalVenta * pct / 100 * 100) / 100)}</span>
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <RbGroup name="rbCA" a={!ca} b={ca} onA={() => setCa(false)} onB={() => setCa(true)} labels={['Seleccionar asesor', 'Referenciar por ID']} />
                {!ca ? (
                  <select className={`form-select ${errors.asesorId ? 'is-invalid' : ''}`} value={form.asesorId} disabled={mode === 'edit'} onChange={(e) => setField('asesorId', e.target.value)}>
                    {asesores.length === 0 && <option value="">Sin asesores — activa opción manual</option>}
                    {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}{a.correo ? ` · ${a.correo}` : ''}</option>)}
                  </select>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12"><input placeholder="ID asesor *" disabled={mode === 'edit'} className={`form-control ${errors.asesorId ? 'is-invalid' : ''}`} value={caForm.id} onChange={(e) => setCaForm((f) => ({ ...f, id: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombres *" disabled={mode === 'edit'} className={`form-control ${errors.asesorNombre ? 'is-invalid' : ''}`} value={caForm.nombres} onChange={(e) => setCaForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" disabled={mode === 'edit'} className="form-control" value={caForm.apellidos} onChange={(e) => setCaForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-12"><input placeholder="Correo" disabled={mode === 'edit'} type="email" className="form-control" value={caForm.correo} onChange={(e) => setCaForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.asesorId || errors.asesorNombre) && <div className="invalid-feedback d-block small">{errors.asesorId || errors.asesorNombre}</div>}
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Porcentaje *</label>
                <div className="input-group">
                  <input type="number" className={`form-control ${errors.porcentajeComision ? 'is-invalid' : ''}`} min={0} max={100} step={0.01} value={form.porcentajeComision} onChange={(e) => setField('porcentajeComision', e.target.value ? parseFloat(e.target.value) : 0)} />
                  <span className="input-group-text bg-white text-muted">%</span>
                </div>
                {errors.porcentajeComision && <div className="invalid-feedback d-block small">{errors.porcentajeComision}</div>}
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Monto *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.montoComision ? 'is-invalid' : ''}`} min={0} step={0.01} value={form.montoComision} onChange={(e) => setField('montoComision', e.target.value ? parseFloat(e.target.value) : 0)} />
                  {errors.montoComision && <div className="invalid-feedback d-block small">{errors.montoComision}</div>}
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Estado</label>
                <select className="form-select" value={form.estado} onChange={(e) => setField('estado', e.target.value as EstadoComision)}>
                  {ESTADOS_COMISION.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">F. generación</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaGeneracion)} onChange={(e) => setField('fechaGeneracion', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">F. pago</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaPago)} onChange={(e) => setField('fechaPago', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Observaciones</label>
                <input className="form-control" value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear comisión' : 'Guardar cambios'}
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
      <div className="form-check"><input className="form-check-input" type="radio" id={`${name}_A`} name={name} checked={a} onChange={onA} /><label className="form-check-label small" htmlFor={`${name}_A`}>{labels[0]}</label></div>
      <div className="form-check"><input className="form-check-input" type="radio" id={`${name}_B`} name={name} checked={b} onChange={onB} /><label className="form-check-label small" htmlFor={`${name}_B`}>{labels[1]}</label></div>
    </div>
  );
}
