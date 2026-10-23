'use client';

import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { getSession, http, humanizeToken } from '@/lib/api';
import {
  CreatePropiedadInput,
  ESTADOS_PROPIEDAD,
  EstadoPropiedad,
  Propiedad,
  ProyectoLight,
  TIPOS_PROPIEDAD,
  TipoPropiedad,
  UpdatePropiedadInput,
} from '@/lib/propiedades';

type Mode = 'create' | 'edit';

export default function PropiedadModal({
  open,
  mode,
  initial,
  proyectos,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: Propiedad | null;
  proyectos: ProyectoLight[];
  onClose: () => void;
  onSaved: (p: Propiedad, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const [form, setForm] = useState<CreatePropiedadInput>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [proyectoOtro, setProyectoOtro] = useState(false);
  const [proyectoOtroNombre, setProyectoOtroNombre] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const B = (window as any).bootstrap;
    if (!modalRef.current) return;
    if (!bsRef.current && B?.Modal) {
      bsRef.current = new B.Modal(modalRef.current, { backdrop: 'static', keyboard: false });
    }
    if (bsRef.current) {
      if (open) {
        resetToInitial(initial);
        bsRef.current.show();
      } else {
        bsRef.current.hide();
      }
    }
  }, [open, initial]);

  function resetToInitial(prop: Propiedad | null) {
    if (prop) {
      setForm({
        codigoInterno: prop.codigoInterno,
        nombre: prop.nombre,
        tipoPropiedad: prop.tipoPropiedad,
        estado: prop.estado,
        precio: parseFloat(prop.precio || '0'),
        areaTotal: prop.areaTotal != null ? parseFloat(prop.areaTotal) : null,
        areaConstruida: prop.areaConstruida != null ? parseFloat(prop.areaConstruida) : null,
        habitaciones: prop.habitaciones,
        banos: prop.banos,
        estacionamientos: prop.estacionamientos,
        piso: prop.piso,
        direccion: prop.direccion,
        distrito: prop.distrito,
        ciudad: prop.ciudad,
        latitud: prop.latitud != null ? parseFloat(prop.latitud) : null,
        longitud: prop.longitud != null ? parseFloat(prop.longitud) : null,
        descripcion: prop.descripcion,
        proyectoId: prop.proyectoId,
      });
      setProyectoOtro(false);
      setProyectoOtroNombre(prop.proyecto?.nombre || '');
    } else {
      setForm(emptyForm());
      setProyectoOtro(proyectos.length === 0);
      setProyectoOtroNombre('');
    }
    setErrors({});
    setGlobalErr(null);
  }

  function emptyForm(): CreatePropiedadInput {
    return {
      codigoInterno: '',
      nombre: '',
      tipoPropiedad: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
      precio: 0,
      areaTotal: null,
      areaConstruida: null,
      habitaciones: null,
      banos: null,
      estacionamientos: null,
      piso: null,
      direccion: null,
      distrito: null,
      ciudad: null,
      latitud: null,
      longitud: null,
      descripcion: null,
      proyectoId: '',
      proyectoNombre: '',
    };
  }

  function setField<K extends keyof CreatePropiedadInput>(k: K, v: CreatePropiedadInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.codigoInterno.trim()) e.codigoInterno = 'El código interno es obligatorio.';
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (!form.tipoPropiedad) e.tipoPropiedad = 'Selecciona un tipo.';
    if (form.precio == null || isNaN(form.precio) || form.precio < 0) e.precio = 'Precio inválido.';
    if (proyectoOtro) {
      if (!proyectoOtroNombre.trim()) e.proyectoOtroNombre = 'Nombre de proyecto es obligatorio.';
    } else if (!form.proyectoId) {
      e.proyectoId = 'Selecciona un proyecto.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setGlobalErr(null);
    if (!validate()) return;
    const sess = getSession();
    if (!sess) return;

    const payload: CreatePropiedadInput = {
      ...form,
      codigoInterno: form.codigoInterno.trim(),
      nombre: form.nombre.trim(),
      proyectoId: form.proyectoId?.trim() || undefined,
      proyectoNombre: undefined,
    };

    if (proyectoOtro && proyectoOtroNombre.trim()) {
      payload.proyectoId = undefined;
      payload.proyectoNombre = proyectoOtroNombre.trim();
    }

    setSaving(true);
    try {
      const url = `/empresas/${sess.usuario.empresaId}/propiedades` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http.patch : http.post;
      const data: UpdatePropiedadInput | CreatePropiedadInput = mode === 'edit' ? payload : payload;
      const { data: saved } = await method<Propiedad>(url, data);
      onSaved(saved, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      setGlobalErr(e.response?.data?.message ?? 'No se pudo guardar la propiedad.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nueva propiedad' : `Editar propiedad ${initial?.codigoInterno || ''}`;

  return (
    <div
      className="modal fade"
      id="propiedadModal"
      tabIndex={-1}
      aria-labelledby="propiedadModalLabel"
      aria-hidden="true"
      ref={modalRef}
      data-bs-backdrop="static"
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="propiedadModalLabel">
              <i className="bi bi-building me-2 text-primary" />
              {title}
            </h1>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
              disabled={saving}
            />
          </div>
          <div className="modal-body">
            {globalErr && (
              <div className="alert alert-danger small d-flex align-items-center gap-2 py-2" role="alert">
                <i className="bi bi-exclamation-triangle-fill" />
                <div>{globalErr}</div>
              </div>
            )}

            <div className="row g-3">
              <Field label="Código interno *" className="col-md-4" invalid={!!errors.codigoInterno} feedback={errors.codigoInterno}>
                <input
                  className="form-control"
                  maxLength={50}
                  value={form.codigoInterno}
                  onChange={(e) => setField('codigoInterno', e.target.value)}
                  placeholder="DEP-001"
                />
              </Field>

              <Field label="Nombre *" className="col-md-8" invalid={!!errors.nombre} feedback={errors.nombre}>
                <input
                  className="form-control"
                  maxLength={150}
                  value={form.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder="Ej. Departamento 1203"
                />
              </Field>

              <Field label="Tipo de propiedad *" className="col-md-4">
                <select
                  className="form-select"
                  value={form.tipoPropiedad}
                  onChange={(e) => setField('tipoPropiedad', e.target.value as TipoPropiedad)}
                >
                  {TIPOS_PROPIEDAD.map((t) => (
                    <option key={t} value={t}>{humanizeToken(t)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Estado" className="col-md-4">
                <select
                  className="form-select"
                  value={form.estado || ''}
                  onChange={(e) => setField('estado', (e.target.value || 'DISPONIBLE') as EstadoPropiedad)}
                >
                  {ESTADOS_PROPIEDAD.map((st) => (
                    <option key={st} value={st}>{humanizeToken(st)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Precio (PEN) *" className="col-md-4" invalid={!!errors.precio} feedback={errors.precio}>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => setField('precio', parseFloat(e.target.value || '0'))}
                />
              </Field>

              <Field label="Proyecto *" className="col-12" invalid={!!errors.proyectoId || !!errors.proyectoOtroNombre} feedback={errors.proyectoId || errors.proyectoOtroNombre}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="proyectoRb"
                      id="rbProyExiste"
                      checked={!proyectoOtro}
                      onChange={() => {
                        setProyectoOtro(false);
                        setProyectoOtroNombre('');
                        setField('proyectoNombre', undefined);
                      }}
                    />
                    <label className="form-check-label small" htmlFor="rbProyExiste">Seleccionar existente</label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="proyectoRb"
                      id="rbProyOtro"
                      checked={proyectoOtro}
                      onChange={() => {
                        setProyectoOtro(true);
                        setField('proyectoId', '');
                      }}
                    />
                    <label className="form-check-label small" htmlFor="rbProyOtro">Escribir proyecto nuevo</label>
                  </div>
                </div>
                {!proyectoOtro ? (
                  <select
                    className="form-select"
                    value={form.proyectoId || ''}
                    onChange={(e) => setField('proyectoId', e.target.value)}
                  >
                    <option value="">
                      {proyectos.length === 0 ? 'Sin proyectos - activa la opcion "escribir"' : 'Selecciona un proyecto'}
                    </option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">ID del proyecto (opcional)</label>
                      <input
                        className="form-control"
                        value={form.proyectoId || ''}
                        onChange={(e) => setField('proyectoId', e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Nombre del proyecto (obligatorio)</label>
                      <input
                        className="form-control"
                        value={proyectoOtroNombre}
                        onChange={(e) => setProyectoOtroNombre(e.target.value)}
                        placeholder="Nombre visual del proyecto"
                      />
                    </div>
                  </div>
                )}
              </Field>

              <div className="col-12"><hr className="my-1" /></div>

              <Field label="Área total (m²)" className="col-md-3">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step="0.01"
                  value={numStr(form.areaTotal)}
                  onChange={(e) => setField('areaTotal', optionalNum(e.target.value))}
                />
              </Field>
              <Field label="Área construida (m²)" className="col-md-3">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step="0.01"
                  value={numStr(form.areaConstruida)}
                  onChange={(e) => setField('areaConstruida', optionalNum(e.target.value))}
                />
              </Field>
              <Field label="Habitaciones" className="col-md-2">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step={1}
                  value={numStr(form.habitaciones)}
                  onChange={(e) => setField('habitaciones', optionalInt(e.target.value))}
                />
              </Field>
              <Field label="Baños" className="col-md-2">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step={1}
                  value={numStr(form.banos)}
                  onChange={(e) => setField('banos', optionalInt(e.target.value))}
                />
              </Field>
              <Field label="Estacionamientos" className="col-md-2">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step={1}
                  value={numStr(form.estacionamientos)}
                  onChange={(e) => setField('estacionamientos', optionalInt(e.target.value))}
                />
              </Field>
              <Field label="Piso" className="col-md-3">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step={1}
                  value={numStr(form.piso)}
                  onChange={(e) => setField('piso', optionalInt(e.target.value))}
                />
              </Field>

              <div className="col-12"><hr className="my-1" /></div>

              <Field label="Dirección" className="col-md-6">
                <input
                  className="form-control"
                  maxLength={255}
                  value={form.direccion || ''}
                  onChange={(e) => setField('direccion', e.target.value || null)}
                  placeholder="Av. Arequipa 123"
                />
              </Field>
              <Field label="Distrito" className="col-md-3">
                <input
                  className="form-control"
                  maxLength={100}
                  value={form.distrito || ''}
                  onChange={(e) => setField('distrito', e.target.value || null)}
                  placeholder="Miraflores"
                />
              </Field>
              <Field label="Ciudad" className="col-md-3">
                <input
                  className="form-control"
                  maxLength={100}
                  value={form.ciudad || ''}
                  onChange={(e) => setField('ciudad', e.target.value || null)}
                  placeholder="Lima"
                />
              </Field>
              <Field label="Latitud" className="col-md-6">
                <input
                  type="number"
                  className="form-control"
                  step="0.00000001"
                  min={-90}
                  max={90}
                  value={numStr(form.latitud)}
                  onChange={(e) => setField('latitud', optionalNum(e.target.value))}
                />
              </Field>
              <Field label="Longitud" className="col-md-6">
                <input
                  type="number"
                  className="form-control"
                  step="0.00000001"
                  min={-180}
                  max={180}
                  value={numStr(form.longitud)}
                  onChange={(e) => setField('longitud', optionalNum(e.target.value))}
                />
              </Field>
              <Field label="Descripción" className="col-12">
                <textarea
                  className="form-control"
                  rows={3}
                  maxLength={1000}
                  value={form.descripcion || ''}
                  onChange={(e) => setField('descripcion', e.target.value || null)}
                  placeholder="Características adicionales"
                />
              </Field>

              <div className="col-12">
                <div className="alert alert-light small mb-0 d-flex align-items-center gap-2 py-2">
                  <i className="bi bi-info-circle text-info" />
                  <div>
                    Si escribes un proyecto nuevo, el sistema lo creara automaticamente para tu empresa.
                    Si ya existe uno con ese mismo nombre, lo reutilizara.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear propiedad' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
  invalid,
  feedback,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
  invalid?: boolean;
  feedback?: string;
}) {
  return (
    <div className={`${className || ''}`}>
      <label className="form-label small fw-semibold">{label}</label>
      {invalid ? (
        <div data-invalid={invalid}>{children}</div>
      ) : (
        children
      )}
      {invalid && feedback && <div className="invalid-feedback d-block small">{feedback}</div>}
    </div>
  );
}

function numStr(v: number | null | undefined) {
  return v == null || isNaN(v as number) ? '' : String(v);
}

function optionalNum(v: string): number | null {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function optionalInt(v: string): number | null {
  if (v === '' || v == null) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
