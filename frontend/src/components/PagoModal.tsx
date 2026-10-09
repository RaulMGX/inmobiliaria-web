'use client';

import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPEN, getSession } from '@/lib/api';
import {
  CreatePagoInput,
  ESTADOS_PAGO,
  EstadoPago,
  METODOS_PAGO,
  MetodoPagoPago,
  Pago,
  PagoVentaLight,
  UpdatePagoInput,
  Venta,
} from '@/lib/ventas-pagos';

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

import { http } from '@/lib/api';

export default function PagoModal({
  open,
  mode,
  initial,
  ventas,
  onVentaRefAdd,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: Pago | null;
  ventas: Venta[];
  onVentaRefAdd: (ref: Venta) => void;
  onClose: () => void;
  onSaved: (p: Pago, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const [form, setForm] = useState<CreatePagoInput>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cv, setCv] = useState(ventas.length === 0);
  const [cvForm, setCvForm] = useState({ id: '' });

  function empty(): CreatePagoInput {
    const now = new Date();
    return {
      ventaId: ventas[0]?.id || '',
      numeroCuota: null,
      fechaVencimiento: null,
      fechaPago: now.toISOString(),
      monto: 0,
      estado: 'PAGADO',
      metodoPago: null,
      numeroOperacion: null,
      observaciones: null,
      registradoPorId: sess?.usuario.id || null,
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
      if (open) {
        reset();
        bsRef.current.show();
      } else {
        bsRef.current.hide();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    if (initial) {
      setForm({
        ventaId: initial.ventaId,
        numeroCuota: initial.numeroCuota,
        fechaVencimiento: initial.fechaVencimiento,
        fechaPago: initial.fechaPago,
        monto: parseFloat(initial.monto || '0'),
        estado: initial.estado,
        metodoPago: initial.metodoPago,
        numeroOperacion: initial.numeroOperacion,
        observaciones: initial.observaciones,
        registradoPorId: initial.registradoPorId,
      });
      setCv(!ventas.find((v) => v.id === initial.ventaId));
      setCvForm({ id: initial.ventaId });
    } else {
      setForm(empty());
      setCv(ventas.length === 0);
    }
    setErrors({});
    setGlobalErr(null);
  }

  function setField<K extends keyof CreatePagoInput>(k: K, v: CreatePagoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const selectedVenta: PagoVentaLight | undefined = useMemo(() => {
    if (initial && initial.ventaId === form.ventaId) return initial.venta;
    const v = ventas.find((x) => x.id === form.ventaId);
    if (!v) return undefined;
    return {
      id: v.id, estado: v.estado, fechaVenta: v.fechaVenta,
      totalVenta: v.totalVenta, saldoPendiente: v.saldoPendiente,
      cliente: v.cliente, asesor: v.asesor, propiedad: v.propiedad,
    };
  }, [form.ventaId, ventas, initial]);

  function validate() {
    const e: Record<string, string> = {};
    if (mode === 'create' && form.estado && form.estado !== 'PAGADO') e.estado = 'Solo se permite crear pagos en estado PAGADO.';
    if (!form.monto || isNaN(Number(form.monto)) || Number(form.monto) <= 0) e.monto = 'Monto debe ser > 0.';
    if (cv) {
      if (!cvForm.id.trim()) e.ventaId = 'ID venta requerido.';
    } else if (!form.ventaId) e.ventaId = 'Selecciona venta.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sess) return;
    if (!validate()) return;
    setSaving(true);
    setGlobalErr(null);
    if (cv && cvForm.id.trim()) {
      // placeholder reference will be replaced on page reload; do not add invalid venta to cache.
    }

    const ventaId = cv ? cvForm.id.trim() : form.ventaId;
    const payload: CreatePagoInput = {
      ...form,
      ventaId,
      fechaVencimiento: form.fechaVencimiento ? toIso(toLocal(form.fechaVencimiento)) : null,
      fechaPago: form.fechaPago ? toIso(toLocal(form.fechaPago)) : null,
      monto: Number(form.monto),
      numeroCuota: form.numeroCuota ? Number(form.numeroCuota) : null,
      numeroOperacion: form.numeroOperacion?.trim() || null,
      observaciones: form.observaciones?.trim() || null,
      registradoPorId: form.registradoPorId?.trim() || null,
    };

    try {
      const url = `/empresas/${sess.usuario.empresaId}/pagos` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const body: CreatePagoInput | UpdatePagoInput = payload;
      const { data } = await method<Pago>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar el pago.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Registrar pago' : `Editar pago ${initial?.id.slice(0, 8) || ''}`;
  const tv = selectedVenta ? parseFloat(selectedVenta.totalVenta || '0') : 0;
  const sp = selectedVenta ? parseFloat(selectedVenta.saldoPendiente || '0') : 0;
  const montoPagar = Number(form.monto ?? 0);

  return (
    <div className="modal fade" id="pagoModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={modalRef}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="pagoModalLabel">
              <i className="bi bi-cash-coin me-2 text-success" />{title}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && <div className="alert alert-danger small py-2 d-flex align-items-center gap-2" role="alert"><i className="bi bi-exclamation-triangle-fill" /><div>{globalErr}</div></div>}
            <div className="row g-3">
              <div className="col-md-12">
                <RbGroup name="rbPV" a={!cv} b={cv} onA={() => setCv(false)} onB={() => setCv(true)} labels={['Seleccionar venta', 'Referenciar por ID']} />
                {!cv ? (
                  <select className={`form-select ${errors.ventaId ? 'is-invalid' : ''}`} value={form.ventaId} disabled={mode === 'edit'} onChange={(e) => setField('ventaId', e.target.value)}>
                    {ventas.length === 0 && <option value="">Sin ventas — activa opción manual</option>}
                    {ventas.map((v) => <option key={v.id} value={v.id}>{v.id.slice(0, 10)}… · {v.cliente.nombres} {v.cliente.apellidos} · {formatPEN(v.saldoPendiente)} saldo</option>)}
                  </select>
                ) : (
                  <input placeholder="ID venta *" disabled={mode === 'edit'} className={`form-control ${errors.ventaId ? 'is-invalid' : ''}`} value={cvForm.id} onChange={(e) => setCvForm((f) => ({ ...f, id: e.target.value }))} />
                )}
                {errors.ventaId && <div className="invalid-feedback d-block small">{errors.ventaId}</div>}
                {selectedVenta && (
                  <div className="mt-2 p-3 rounded border bg-light row g-2 align-items-center">
                    <div className="col-md-6 small">
                      <span className="fw-semibold text-muted">Cliente: </span>{selectedVenta.cliente.nombres} {selectedVenta.cliente.apellidos}
                      <br />
                      <span className="fw-semibold text-muted">Propiedad: </span>[{selectedVenta.propiedad.codigoInterno}] {selectedVenta.propiedad.nombre}
                    </div>
                    <div className="col-md-3 small text-end">
                      <div><span className="text-muted">Total: </span><span className="fw-semibold">{formatPEN(tv)}</span></div>
                      <div><span className="text-muted">Saldo: </span><span className={`fw-bold ${sp > 0 ? 'text-danger' : 'text-success'}`}>{formatPEN(sp)}</span></div>
                    </div>
                    <div className="col-md-3 small text-end">
                      <span className="text-muted">Estado: </span>
                      <span className={`badge ${selectedVenta.estado === 'PAGADA' ? 'badge-soft-success' : selectedVenta.estado === 'ANULADA' ? 'badge-soft-secondary' : 'badge-soft-primary'} fw-semibold`}>{selectedVenta.estado.replace(/_/g, ' ')}</span>
                      {sp > 0 && montoPagar > sp && <div className="text-danger mt-1" style={{ fontSize: '.75rem' }}>Monto mayor que saldo</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="col-md-3">
                <label className="form-label small fw-semibold">Monto (PEN) *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.monto ? 'is-invalid' : ''}`} min={0.01} step={0.01} value={form.monto} onChange={(e) => setField('monto', e.target.value ? parseFloat(e.target.value) : 0)} />
                  {errors.monto && <div className="invalid-feedback d-block small">{errors.monto}</div>}
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">N° cuota</label>
                <input type="number" className="form-control" min={1} step={1} value={form.numeroCuota ?? ''} onChange={(e) => setField('numeroCuota', e.target.value ? parseInt(e.target.value, 10) : null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha pago</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaPago)} onChange={(e) => setField('fechaPago', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha vencimiento</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaVencimiento)} onChange={(e) => setField('fechaVencimiento', e.target.value ? toIso(e.target.value) : null)} />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-semibold">Estado</label>
                <select className={`form-select ${errors.estado ? 'is-invalid' : ''}`} value={form.estado || ''} onChange={(e) => setField('estado', (e.target.value as EstadoPago) || undefined)}>
                  {ESTADOS_PAGO.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
                {errors.estado && <div className="invalid-feedback d-block small">{errors.estado}</div>}
                {mode === 'create' && <div className="form-text mt-0" style={{ fontSize: '.72rem' }}>Solo PAGADO permitido al crear.</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Método de pago</label>
                <select className="form-select" value={form.metodoPago || ''} onChange={(e) => setField('metodoPago', (e.target.value as MetodoPagoPago) || null)}>
                  <option value="">—</option>
                  {METODOS_PAGO.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">N° operación</label>
                <input className="form-control" maxLength={100} value={form.numeroOperacion || ''} onChange={(e) => setField('numeroOperacion', e.target.value || null)} placeholder="OP-XXXXXXX" />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Registrado por (ID)</label>
                <input className="form-control" value={form.registradoPorId || ''} onChange={(e) => setField('registradoPorId', e.target.value || null)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Observaciones</label>
                <input className="form-control" value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} />
              </div>

              <div className="col-12">
                <div className="alert alert-light small py-2 mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle text-info" />
                  <div>El backend actualiza automáticamente el saldo de la venta y su estado al completarse.</div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Registrar pago' : 'Guardar cambios'}
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
