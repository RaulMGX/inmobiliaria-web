'use client';

import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { formatPEN, getSession, initials } from '@/lib/api';
import {
  AsesorLight,
  ClienteLight,
  CreateVentaInput,
  ESTADOS_VENTA,
  EstadoVenta,
  METODOS_VENTA,
  MetodoPagoVenta,
  PropiedadLight,
  ReservaLight,
  UpdateVentaInput,
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

export default function VentaModal({
  open,
  mode,
  initial,
  clientes,
  asesores,
  propiedades,
  reservas,
  onRefAdd,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: Venta | null;
  clientes: ClienteLight[];
  asesores: AsesorLight[];
  propiedades: PropiedadLight[];
  reservas: ReservaLight[];
  onRefAdd: (kind: 'cliente' | 'asesor' | 'propiedad' | 'reserva', ref: any) => void;
  onClose: () => void;
  onSaved: (v: Venta, mode: Mode) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bsRef = useRef<any>(null);
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';
  const yoId = sess?.usuario.id || '';
  const yoNombres = sess?.usuario.nombres || '';
  const yoApellidos = sess?.usuario.apellidos || '';
  const yoCorreo = sess?.usuario.correo || '';
  const [form, setForm] = useState<CreateVentaInput>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const refsFetchedRef = useRef(false);
  const localRefsRef = useRef({ clientes, asesores, propiedades, reservas });
  useEffect(() => { localRefsRef.current = { clientes, asesores, propiedades, reservas }; }, [clientes, asesores, propiedades, reservas]);

  const lookupDebRef = useRef<number | undefined>(undefined);
  const [lookupStatus, setLookupStatus] = useState<{ reserva?: string; cliente?: string; asesor?: string; propiedad?: string }>({});
  const [cc, setCc] = useState(false);
  const [ccForm, setCcForm] = useState({ id: '', nombres: '', apellidos: '', correo: '', celular: '' });
  const [ca, setCa] = useState(false);
  const [caForm, setCaForm] = useState({ id: yoId, nombres: yoNombres, apellidos: yoApellidos, correo: yoCorreo });
  const [cp, setCp] = useState(false);
  const [cpForm, setCpForm] = useState({ id: '', codigoInterno: '', nombre: '' });
  const [cr, setCr] = useState(false);
  const [crForm, setCrForm] = useState({ id: '' });

  function asesorDefaultId(): string {
    if (yoId && asesores.some((a) => a.id === yoId)) return yoId;
    return asesores[0]?.id || yoId || '';
  }

  function empty(): CreateVentaInput {
    const asi = asesorDefaultId();
    return {
      reservaId: reservas.find((r) => r.estado === 'ACTIVA')?.id || reservas[0]?.id || '',
      clienteId: clientes[0]?.id || '',
      propiedadId: propiedades[0]?.id || '',
      asesorId: asi,
      estado: 'PENDIENTE_FORMALIZACION',
      metodoPago: 'CONTADO',
      fechaVenta: new Date().toISOString(),
      precioFinal: 0,
      descuento: 0,
      impuestos: 0,
      totalVenta: 0,
      observaciones: null,
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

  useEffect(() => {
    if (!open || !empresaId) return;
    if (mode !== 'create' || refsFetchedRef.current) return;
    const { clientes: c, asesores: a, propiedades: p, reservas: r } = localRefsRef.current;
    const needR = r.length === 0, needC = c.length === 0, needP = p.length === 0;
    const needA = a.length === 0 && !yoId;
    if (!needR && !needC && !needA && !needP) {
      refsFetchedRef.current = true;
      if (yoId) onRefAdd('asesor', { id: yoId, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || null });
      return;
    }
    refsFetchedRef.current = true;
    (async () => {
      setLoadingRefs(true);
      try {
        const tasks: Promise<any>[] = [];
        if (needC) tasks.push(http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }).then((r2) => ({ tipo: 'c', ok: true, r: r2 })).catch((e) => ({ tipo: 'c', ok: false, e })));
        if (needP) tasks.push(http.get<any>(`/empresas/${empresaId}/propiedades`, { params: { page: 1, limit: 100 } }).then((r2) => ({ tipo: 'p', ok: true, r: r2 })).catch((e) => ({ tipo: 'p', ok: false, e })));
        if (needR) tasks.push(http.get<any>(`/empresas/${empresaId}/reservas`, { params: { page: 1, limit: 100 } }).then((r2) => ({ tipo: 'r', ok: true, r: r2 })).catch((e) => ({ tipo: 'r', ok: false, e })));
        const results = await Promise.all(tasks);
        results.forEach((x: any) => {
          if (!x.ok) return;
          const arr = (x.r.data?.data ?? x.r.data ?? []) as any[];
          arr.forEach((it: any) => {
            if (!it?.id) return;
            if (x.tipo === 'c') onRefAdd('cliente', { id: it.id, nombres: it.nombres || '', apellidos: it.apellidos || '', correo: it.correo || null, celular: it.celular || null, estado: it.estado || 'NUEVO' });
            if (x.tipo === 'p') onRefAdd('propiedad', { id: it.id, codigoInterno: it.codigoInterno || it.id, nombre: it.nombre || it.codigoInterno || it.id, estado: it.estado || 'DISPONIBLE', proyecto: it.proyecto || null });
            if (x.tipo === 'r') onRefAdd('reserva', { id: it.id, estado: it.estado || 'PENDIENTE', fechaReserva: it.fechaReserva, fechaVencimiento: it.fechaVencimiento, montoSeparacion: it.montoSeparacion || '0', clienteId: it.clienteId, propiedadId: it.propiedadId, asesorId: it.asesorId, precioFinal: it.precioFinal || it.montoSeparacion || '0' });
          });
        });
        if (yoId) onRefAdd('asesor', { id: yoId, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || null });
      } finally {
        setLoadingRefs(false);
      }
    })();
  }, [open, empresaId, mode, sess, onRefAdd, yoId, yoNombres, yoApellidos, yoCorreo]);

  function reset() {
    if (initial) {
      setForm({
        reservaId: initial.reservaId,
        clienteId: initial.clienteId,
        propiedadId: initial.propiedadId,
        asesorId: initial.asesorId,
        estado: initial.estado,
        metodoPago: initial.metodoPago,
        fechaVenta: initial.fechaVenta,
        precioFinal: parseFloat(initial.precioFinal || '0'),
        descuento: parseFloat(initial.descuento || '0'),
        impuestos: initial.impuestos ? parseFloat(initial.impuestos) : 0,
        totalVenta: parseFloat(initial.totalVenta || '0'),
        observaciones: initial.observaciones,
      });
      setCc(!clientes.find((c) => c.id === initial.clienteId));
      setCcForm({ id: initial.clienteId, nombres: initial.cliente.nombres, apellidos: initial.cliente.apellidos, correo: initial.cliente.correo || '', celular: initial.cliente.celular || '' });
      setCa(!asesores.find((a) => a.id === initial.asesorId));
      setCaForm({ id: initial.asesorId, nombres: initial.asesor.nombres, apellidos: initial.asesor.apellidos, correo: initial.asesor.correo || '' });
      setCp(!propiedades.find((p) => p.id === initial.propiedadId));
      setCpForm({ id: initial.propiedadId, codigoInterno: initial.propiedad.codigoInterno, nombre: initial.propiedad.nombre });
      setCr(!reservas.find((r) => r.id === initial.reservaId));
      setCrForm({ id: initial.reservaId });
    } else {
      setForm(empty());
      setCr(false);
      setCc(false);
      setCa(false);
      setCp(false);
      setCrForm({ id: '' });
      setCcForm({ id: '', nombres: '', apellidos: '', correo: '', celular: '' });
      setCaForm({ id: yoId, nombres: yoNombres, apellidos: yoApellidos, correo: yoCorreo });
      setCpForm({ id: '', codigoInterno: '', nombre: '' });
    }
    setErrors({});
    setGlobalErr(null);
    setLookupStatus({});
  }

  function setField<K extends keyof CreateVentaInput>(k: K, v: CreateVentaInput[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'precioFinal' || k === 'descuento' || k === 'impuestos') {
        const pf = Number(next.precioFinal ?? 0);
        const d = Number(next.descuento ?? 0);
        const im = Number(next.impuestos ?? 0);
        const calculated = Math.max(0, pf - d + im);
        if (!f.totalVenta || Math.abs(Number(f.totalVenta) - calculated) < 0.01) {
          next.totalVenta = calculated;
        }
      }
      return next;
    });
  }

  function autofillDesdeReserva(res: ReservaLight | undefined | null) {
    if (!res) return;
    const resAny = res as any;
    if (resAny.clienteId) {
      const cId: string = String(resAny.clienteId);
      const c = clientes.find((x) => x.id === cId);
      if (c) {
        setCc(false);
        setCcForm({ id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || '', celular: c.celular || '' });
        setForm((f) => ({ ...f, clienteId: c.id }));
      } else {
        setForm((f) => ({ ...f, clienteId: cId }));
        setCc(true);
        setCcForm((f) => ({ ...f, id: cId }));
      }
    }
    if (resAny.asesorId) {
      const aId: string = String(resAny.asesorId);
      const a = asesores.find((x) => x.id === aId);
      if (a) {
        setCa(false);
        setCaForm({ id: a.id, nombres: a.nombres, apellidos: a.apellidos, correo: a.correo || '' });
        setForm((f) => ({ ...f, asesorId: a.id }));
      } else if (yoId && aId === yoId) {
        setCa(false);
        setCaForm({ id: yoId, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || '' });
        setForm((f) => ({ ...f, asesorId: yoId }));
        if (!asesores.some((x) => x.id === yoId)) onRefAdd('asesor', { id: yoId, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || null });
      } else {
        setForm((f) => ({ ...f, asesorId: aId }));
        setCa(true);
        setCaForm((f) => ({ ...f, id: aId }));
      }
    }
    if (resAny.propiedadId) {
      const pId: string = String(resAny.propiedadId);
      const p = propiedades.find((x) => x.id === pId);
      if (p) {
        setCp(false);
        setCpForm({ id: p.id, codigoInterno: p.codigoInterno, nombre: p.nombre });
        setForm((f) => {
          const pfRaw = (p as any).precio;
          const pf = pfRaw != null ? (Number(pfRaw) || 0) : (Number(f.precioFinal ?? 0) || 0);
          const d = Number(f.descuento ?? 0);
          const im = Number(f.impuestos ?? 0);
          const calc = Math.max(0, pf - d + im);
          return {
            ...f,
            propiedadId: p.id,
            ...(pf > 0 ? { precioFinal: pf } : {}),
            totalVenta: (!f.totalVenta || Math.abs(Number(f.totalVenta) - calc) < 0.01) ? calc : Number(f.totalVenta),
          };
        });
      } else {
        setForm((f) => ({ ...f, propiedadId: pId }));
        setCp(true);
        setCpForm((f) => ({ ...f, id: pId }));
      }
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!open || !empresaId) return;
    if (yoId && asesores.length > 0 && !asesores.some((a) => a.id === yoId)) {
      onRefAdd('asesor', { id: yoId, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asesores.length]);

  useEffect(() => {
    if (!cc) return;
    if (form.asesorId !== yoId && yoId) {
      // si asesores vacío sin yo → no-op; keep default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.asesorId]);

  useEffect(() => {
    if (!form.reservaId || cr) return;
    const res = reservas.find((r) => r.id === form.reservaId);
    if (res) autofillDesdeReserva(res);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.reservaId, cr]);

  useEffect(() => {
    if (cr || !crForm.id.trim() || !empresaId) return;
    if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current);
    const id = crForm.id.trim();
    setLookupStatus((s) => ({ ...s, reserva: '⏳' }));
    lookupDebRef.current = window.setTimeout(() => {
      (async () => {
        try {
          const local = reservas.find((r) => r.id === id);
          if (local) {
            autofillDesdeReserva(local);
            setCrForm({ id });
            setLookupStatus((s) => ({ ...s, reserva: undefined }));
            return;
          }
          const { data } = await http.get<ReservaLight>(`/empresas/${empresaId}/reservas/${id}`);
          const dAny = data as any;
          onRefAdd('reserva', { id: data.id, estado: data.estado || 'PENDIENTE', fechaReserva: data.fechaReserva, fechaVencimiento: data.fechaVencimiento, montoSeparacion: data.montoSeparacion || '0', clienteId: dAny.clienteId, propiedadId: dAny.propiedadId, asesorId: dAny.asesorId, precioFinal: dAny.precioFinal || dAny.montoSeparacion || '0' });
          autofillDesdeReserva(data);
          setCrForm({ id: data.id });
          setLookupStatus((s) => ({ ...s, reserva: '✅' }));
        } catch {
          setLookupStatus((s) => ({ ...s, reserva: '❌' }));
        }
      })();
    }, 450);
    return () => { if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crForm.id, cr, empresaId]);

  useEffect(() => {
    if (!cc || !ccForm.id.trim() || !empresaId) return;
    if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current);
    const id = ccForm.id.trim();
    setLookupStatus((s) => ({ ...s, cliente: '⏳' }));
    lookupDebRef.current = window.setTimeout(() => {
      (async () => {
        try {
          const local = clientes.find((c) => c.id === id);
          if (local) {
            setCcForm({ id, nombres: local.nombres, apellidos: local.apellidos, correo: local.correo || '', celular: local.celular || '' });
            setLookupStatus((s) => ({ ...s, cliente: undefined }));
            return;
          }
          const { data } = await http.get<ClienteLight>(`/empresas/${empresaId}/clientes/${id}`);
          const cAny = data as any;
          onRefAdd('cliente', { id: data.id, nombres: data.nombres || '', apellidos: data.apellidos || '', correo: data.correo || null, celular: data.celular || null, estado: cAny.estado || 'NUEVO' });
          setCcForm({ id: data.id, nombres: data.nombres || '', apellidos: data.apellidos || '', correo: data.correo || '', celular: data.celular || '' });
          setLookupStatus((s) => ({ ...s, cliente: '✅' }));
        } catch {
          setLookupStatus((s) => ({ ...s, cliente: '❌' }));
        }
      })();
    }, 450);
    return () => { if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccForm.id, cc, empresaId]);

  useEffect(() => {
    if (!ca || !caForm.id.trim() || !empresaId) return;
    if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current);
    const id = caForm.id.trim();
    setLookupStatus((s) => ({ ...s, asesor: '⏳' }));
    lookupDebRef.current = window.setTimeout(() => {
      (async () => {
        try {
          const local = asesores.find((a) => a.id === id);
          if (local) {
            setCaForm({ id, nombres: local.nombres, apellidos: local.apellidos, correo: local.correo || '' });
            setLookupStatus((s) => ({ ...s, asesor: undefined }));
            return;
          }
          if (yoId && id === yoId) {
            setCaForm({ id, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || '' });
            onRefAdd('asesor', { id: yoId, nombres: yoNombres || '', apellidos: yoApellidos || '', correo: yoCorreo || null });
            setLookupStatus((s) => ({ ...s, asesor: '✅' }));
            return;
          }
          setLookupStatus((s) => ({ ...s, asesor: undefined }));
        } catch {
          setLookupStatus((s) => ({ ...s, asesor: '❌' }));
        }
      })();
    }, 450);
    return () => { if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caForm.id, ca, empresaId]);

  useEffect(() => {
    if (!cp || !cpForm.id.trim() || !empresaId) return;
    if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current);
    const id = cpForm.id.trim();
    setLookupStatus((s) => ({ ...s, propiedad: '⏳' }));
    lookupDebRef.current = window.setTimeout(() => {
      (async () => {
        try {
          const local = propiedades.find((p) => p.id === id);
          if (local) {
            setCpForm({ id, codigoInterno: local.codigoInterno, nombre: local.nombre });
            setLookupStatus((s) => ({ ...s, propiedad: undefined }));
            return;
          }
          const { data } = await http.get<PropiedadLight>(`/empresas/${empresaId}/propiedades/${id}`);
          onRefAdd('propiedad', { id: data.id, codigoInterno: data.codigoInterno || data.id, nombre: data.nombre || data.codigoInterno || data.id, estado: data.estado || 'DISPONIBLE', proyecto: data.proyecto || null });
          setCpForm({ id: data.id, codigoInterno: data.codigoInterno || '', nombre: data.nombre || '' });
          setLookupStatus((s) => ({ ...s, propiedad: '✅' }));
        } catch {
          setLookupStatus((s) => ({ ...s, propiedad: '❌' }));
        }
      })();
    }, 450);
    return () => { if (lookupDebRef.current) window.clearTimeout(lookupDebRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpForm.id, cp, empresaId]);

  function validate() {
    const e: Record<string, string> = {};
    const pf = Number(form.precioFinal ?? 0);
    const d = Number(form.descuento ?? 0);
    const im = Number(form.impuestos ?? 0);
    const tv = Number(form.totalVenta ?? 0);
    if (pf < 0 || d < 0 || im < 0 || tv < 0) e.precioFinal = 'Los montos no pueden ser negativos.';
    if (d > pf) e.descuento = 'Descuento > precioFinal.';
    const minTv = pf - d;
    if (tv < minTv) e.totalVenta = `totalVenta debe ser ≥ ${minTv.toFixed(2)}.`;
    if (!form.metodoPago) e.metodoPago = 'Método de pago requerido.';
    if (cr) {
      if (!crForm.id.trim()) e.reservaId = 'ID reserva requerido.';
    } else if (!form.reservaId) e.reservaId = 'Selecciona reserva.';
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
    if (cp) onRefAdd('propiedad', { id: cpForm.id.trim(), codigoInterno: cpForm.codigoInterno.trim() || cpForm.id.trim(), nombre: cpForm.nombre.trim(), estado: 'VENDIDO', proyecto: null });
    if (cr) onRefAdd('reserva', { id: crForm.id.trim(), estado: 'ACTIVA', fechaReserva: new Date().toISOString(), fechaVencimiento: new Date().toISOString(), montoSeparacion: '0' });

    const reservaId = cr ? crForm.id.trim() : form.reservaId;
    const clienteId = cc ? ccForm.id.trim() : form.clienteId;
    const asesorId = ca ? caForm.id.trim() : form.asesorId;
    const propiedadId = cp ? cpForm.id.trim() : form.propiedadId;

    const payload: any = {
      ...form,
      reservaId,
      clienteId,
      asesorId,
      propiedadId,
      precioFinal: Number(form.precioFinal ?? 0),
      descuento: Number(form.descuento ?? 0),
      impuestos: form.impuestos != null ? Number(form.impuestos) : 0,
      totalVenta: Number(form.totalVenta ?? 0),
    };
    const fv = form.fechaVenta ? toIso(toLocal(form.fechaVenta) || new Date().toISOString()) : null;
    if (fv) payload.fechaVenta = fv; else delete payload.fechaVenta;
    delete payload.empresa; delete payload.reserva; delete payload.cliente; delete payload.propiedad; delete payload.asesor;

    try {
      const url = `/empresas/${sess.usuario.empresaId}/ventas` + (mode === 'edit' && initial ? `/${initial.id}` : '');
      const method = mode === 'edit' ? http_patch : http_post;
      const body: CreateVentaInput | UpdateVentaInput = payload;
      const { data } = await method<Venta>(url, body);
      onSaved(data, mode);
    } catch (err) {
      const e = err as AxiosError<any>;
      const base = e.response?.data?.message || e.message || 'No se pudo guardar la venta.';
      const extra = [
        e.response?.data?.error,
        e.response?.data?.statusCode ? `[${e.response.data.statusCode}]` : '',
        typeof e.response?.data === 'string' ? e.response.data : '',
      ].filter(Boolean).join(' ').trim();
      setGlobalErr(extra ? `${base} ${extra}` : base);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nueva venta' : `Editar venta ${initial?.id.slice(0, 8) || ''}`;

  return (
    <div className="modal fade" id="ventaModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" ref={modalRef}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h1 className="modal-title fs-5 fw-bold" id="ventaModalLabel">
              <i className="bi bi-bag-check me-2 text-primary" />{title}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label="Close" />
          </div>
          <div className="modal-body">
            {globalErr && <div className="alert alert-danger small py-2 d-flex align-items-center gap-2" role="alert"><i className="bi bi-exclamation-triangle-fill" /><div>{globalErr}</div></div>}
            {mode === 'edit' && (
              <div className="alert alert-warning small py-2 mb-3 d-flex align-items-center gap-2" role="alert">
                <i className="bi bi-info-circle" />
                <div>No se puede modificar la reserva, cliente, propiedad ni asesor de una venta existente.</div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-6">
                <RbGroup name="rbVR" a={!cr} b={cr} onA={() => setCr(false)} onB={() => setCr(true)} labels={['Seleccionar reserva', 'Referenciar por ID']} />
                {loadingRefs && <div className="small text-muted mb-1 d-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Cargando reservas…</div>}
                {!cr ? (
                  <>
                    <select className={`form-select ${errors.reservaId ? 'is-invalid' : ''}`} value={form.reservaId} disabled={mode === 'edit' || loadingRefs} onChange={(e) => setField('reservaId', e.target.value)}>
                      <option value="">{reservas.length === 0 ? '⚠️ Pulsa [🔄 Recargar] o usa opción manual' : '-- Selecciona una reserva --'}</option>
                      {reservas.map((r) => <option key={r.id} value={r.id}>[{r.estado}] {r.id.slice(0, 10)} · Sep. {formatPEN(r.montoSeparacion)}</option>)}
                    </select>
                    {reservas.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
                        onClick={() => { refsFetchedRef.current = false; setLoadingRefs(true); (async () => { try { const { data } = await http.get<any>(`/empresas/${empresaId}/reservas`, { params: { page: 1, limit: 100 } }); (data?.data ?? data ?? []).forEach((r: any) => onRefAdd('reserva', { id: r.id, estado: r.estado || 'PENDIENTE', fechaReserva: r.fechaReserva, fechaVencimiento: r.fechaVencimiento, montoSeparacion: r.montoSeparacion || '0', clienteId: r.clienteId, propiedadId: r.propiedadId, asesorId: r.asesorId, precioFinal: r.precioFinal || r.montoSeparacion || '0' })); } finally { setLoadingRefs(false); }})(); }}
                      >
                        <i className="bi bi-arrow-clockwise" /> Recargar reservas
                      </button>
                    )}
                  </>
                ) : (
                  <div className="position-relative">
                    <input placeholder="ID reserva *" disabled={mode === 'edit'} className={`form-control ${errors.reservaId ? 'is-invalid' : ''}`} value={crForm.id} onChange={(e) => setCrForm((f) => ({ ...f, id: e.target.value }))} />
                    {lookupStatus.reserva && <span className="position-absolute top-50 end-2 translate-middle-y small text-muted">{lookupStatus.reserva}</span>}
                  </div>
                )}
                {errors.reservaId && <div className="invalid-feedback d-block small">{errors.reservaId}</div>}
                {mode === 'create' && !cr && reservas.length > 0 && (
                  <>
                    <div className="form-text mt-0 small text-info"><i className="bi bi-lightbulb me-1" />Selecciona una reserva ACTIVA y se rellenarán automáticamente cliente, asesor, propiedad y su precio oficial.</div>
                    {(() => {
                      const r = form.reservaId ? reservas.find((x) => x.id === form.reservaId) : null;
                      const senia = r ? Number(r.montoSeparacion || 0) : 0;
                      if (!r || senia <= 0) return null;
                      const totalVenta = Number(form.totalVenta || 0);
                      const saldoPendiente = Math.max(0, totalVenta - senia);
                      const metodo = form.metodoPago;
                      const esCredito = metodo !== 'CONTADO';
                      return (
                        <>
                          <div className="form-text mt-1 small text-info d-flex align-items-center gap-1">
                            <i className="bi bi-wallet2" />
                            <span>Seña pagada al reservar: <strong>{formatPEN(r.montoSeparacion)}</strong> (se descuenta del total).</span>
                          </div>
                          {totalVenta > 0 && (
                            <div className="form-text mt-1 small fw-semibold d-flex align-items-center gap-1">
                              <i className={`bi ${esCredito ? 'bi-calendar-plus text-warning' : 'bi-check2-circle text-success'}`} />
                              {esCredito ? (
                                <span>Saldo pendiente a financiar/cuotas: <strong className="text-warning">{formatPEN(saldoPendiente)}</strong></span>
                              ) : (
                                <span>Saldo pendiente (al contado): <strong className="text-success">{formatPEN(saldoPendiente)}</strong></span>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha de venta</label>
                <input type="datetime-local" className="form-control" value={toLocal(form.fechaVenta)} onChange={(e) => setField('fechaVenta', e.target.value ? toIso(e.target.value) : null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Estado</label>
                <select className="form-select" value={form.estado} onChange={(e) => setField('estado', e.target.value as EstadoVenta)}>
                  {ESTADOS_VENTA.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="col-md-4">
                <RbGroup name="rbVC" a={!cc} b={cc} onA={() => setCc(false)} onB={() => setCc(true)} labels={['Seleccionar cliente', 'Referenciar por ID']} />
                {loadingRefs && <div className="small text-muted mb-1 d-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Cargando clientes…</div>}
                {!cc ? (
                  <>
                    <select className={`form-select ${errors.clienteId ? 'is-invalid' : ''}`} value={form.clienteId} disabled={mode === 'edit' || loadingRefs} onChange={(e) => setField('clienteId', e.target.value)}>
                      <option value="">{clientes.length === 0 ? '⚠️ Pulsa [🔄 Recargar] o usa opción manual' : '-- Selecciona un cliente --'}</option>
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}{c.correo ? ` · ${c.correo}` : ''}{c.celular ? ` · ${c.celular}` : ''}</option>)}
                    </select>
                    {clientes.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
                        onClick={() => { refsFetchedRef.current = false; setLoadingRefs(true); (async () => { try { const { data } = await http.get<any>(`/empresas/${empresaId}/clientes`, { params: { page: 1, limit: 100 } }); (data?.data ?? data ?? []).forEach((c2: any) => onRefAdd('cliente', { id: c2.id, nombres: c2.nombres, apellidos: c2.apellidos, correo: c2.correo || null, celular: c2.celular || null, estado: c2.estado || 'NUEVO' })); } finally { setLoadingRefs(false); }})(); }}
                      >
                        <i className="bi bi-arrow-clockwise" /> Recargar clientes
                      </button>
                    )}
                  </>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12 position-relative">
                      <input placeholder="ID cliente *" disabled={mode === 'edit'} className={`form-control ${errors.clienteId ? 'is-invalid' : ''}`} value={ccForm.id} onChange={(e) => setCcForm((f) => ({ ...f, id: e.target.value }))} />
                      {lookupStatus.cliente && <span className="position-absolute top-50 end-2 translate-middle-y small text-muted">{lookupStatus.cliente}</span>}
                    </div>
                    <div className="col-6"><input placeholder="Nombres *" disabled={mode === 'edit'} className={`form-control ${errors.clienteNombre ? 'is-invalid' : ''}`} value={ccForm.nombres} onChange={(e) => setCcForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" disabled={mode === 'edit'} className="form-control" value={ccForm.apellidos} onChange={(e) => setCcForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Correo" disabled={mode === 'edit'} type="email" className="form-control" value={ccForm.correo} onChange={(e) => setCcForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Celular" disabled={mode === 'edit'} className="form-control" value={ccForm.celular} onChange={(e) => setCcForm((f) => ({ ...f, celular: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.clienteId || errors.clienteNombre) && <div className="invalid-feedback d-block small">{errors.clienteId || errors.clienteNombre}</div>}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbVA" a={!ca} b={ca} onA={() => setCa(false)} onB={() => setCa(true)} labels={['Seleccionar asesor', 'Referenciar por ID']} />
                {loadingRefs && <div className="small text-muted mb-1 d-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Cargando asesores…</div>}
                {!ca ? (
                  <>
                    <select className={`form-select ${errors.asesorId ? 'is-invalid' : ''}`} value={form.asesorId} disabled={mode === 'edit' || loadingRefs} onChange={(e) => setField('asesorId', e.target.value)}>
                      <option value="">{asesores.length === 0 ? '⚠️ Usa opción manual o pulsa [Nueva venta] para añadirte tú' : '-- Selecciona un asesor --'}</option>
                      {asesores.map((a) => <option key={a.id} value={a.id}>{a.id === yoId ? '👤 (Tú) ' : ''}{a.nombres} {a.apellidos}{a.correo ? ` · ${a.correo}` : ''}</option>)}
                    </select>
                    {form.asesorId === yoId && yoId && <div className="form-text mt-0 small text-success"><i className="bi bi-info-circle me-1" />Por defecto, tu cuenta como asesor asignado.</div>}
                    {asesores.length === 0 && (
                      <div className="small text-muted mt-1 d-flex align-items-center gap-1">
                        <i className="bi bi-info-circle" />
                        <span>Tu cuenta se añadirá al abrir este formulario.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12 position-relative">
                      <input placeholder="ID asesor *" disabled={mode === 'edit'} className={`form-control ${errors.asesorId ? 'is-invalid' : ''}`} value={caForm.id} onChange={(e) => setCaForm((f) => ({ ...f, id: e.target.value }))} />
                      {lookupStatus.asesor && <span className="position-absolute top-50 end-2 translate-middle-y small text-muted">{lookupStatus.asesor}</span>}
                    </div>
                    <div className="col-6"><input placeholder="Nombres *" disabled={mode === 'edit'} className={`form-control ${errors.asesorNombre ? 'is-invalid' : ''}`} value={caForm.nombres} onChange={(e) => setCaForm((f) => ({ ...f, nombres: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Apellidos" disabled={mode === 'edit'} className="form-control" value={caForm.apellidos} onChange={(e) => setCaForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
                    <div className="col-12"><input placeholder="Correo" disabled={mode === 'edit'} type="email" className="form-control" value={caForm.correo} onChange={(e) => setCaForm((f) => ({ ...f, correo: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.asesorId || errors.asesorNombre) && <div className="invalid-feedback d-block small">{errors.asesorId || errors.asesorNombre}</div>}
              </div>

              <div className="col-md-4">
                <RbGroup name="rbVP" a={!cp} b={cp} onA={() => setCp(false)} onB={() => setCp(true)} labels={['Seleccionar propiedad', 'Referenciar por ID']} />
                {loadingRefs && <div className="small text-muted mb-1 d-flex align-items-center gap-1"><span className="spinner-border spinner-border-sm" /> Cargando propiedades…</div>}
                {!cp ? (
                  <>
                    <select className={`form-select ${errors.propiedadId ? 'is-invalid' : ''}`} value={form.propiedadId} disabled={mode === 'edit' || loadingRefs} onChange={(e) => setField('propiedadId', e.target.value)}>
                      <option value="">{propiedades.length === 0 ? '⚠️ Pulsa [🔄 Recargar] o usa opción manual' : '-- Selecciona una propiedad --'}</option>
                      {propiedades.map((p) => <option key={p.id} value={p.id}>[{p.codigoInterno}] {p.nombre}{p.proyecto?.nombre ? ` · ${p.proyecto.nombre}` : ''}</option>)}
                    </select>
                    {propiedades.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
                        onClick={() => { refsFetchedRef.current = false; setLoadingRefs(true); (async () => { try { const { data } = await http.get<any>(`/empresas/${empresaId}/propiedades`, { params: { page: 1, limit: 100 } }); (data?.data ?? data ?? []).forEach((p2: any) => onRefAdd('propiedad', { id: p2.id, codigoInterno: p2.codigoInterno || p2.id, nombre: p2.nombre || p2.codigoInterno || p2.id, estado: p2.estado || 'DISPONIBLE', proyecto: p2.proyecto || null })); } finally { setLoadingRefs(false); }})(); }}
                      >
                        <i className="bi bi-arrow-clockwise" /> Recargar propiedades
                      </button>
                    )}
                  </>
                ) : (
                  <div className="border rounded p-3 row g-2">
                    <div className="col-12 position-relative">
                      <input placeholder="ID propiedad *" disabled={mode === 'edit'} className={`form-control ${errors.propiedadId ? 'is-invalid' : ''}`} value={cpForm.id} onChange={(e) => setCpForm((f) => ({ ...f, id: e.target.value }))} />
                      {lookupStatus.propiedad && <span className="position-absolute top-50 end-2 translate-middle-y small text-muted">{lookupStatus.propiedad}</span>}
                    </div>
                    <div className="col-6"><input placeholder="Código interno" disabled={mode === 'edit'} className="form-control" value={cpForm.codigoInterno} onChange={(e) => setCpForm((f) => ({ ...f, codigoInterno: e.target.value }))} /></div>
                    <div className="col-6"><input placeholder="Nombre *" disabled={mode === 'edit'} className={`form-control ${errors.propiedadNombre ? 'is-invalid' : ''}`} value={cpForm.nombre} onChange={(e) => setCpForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
                  </div>
                )}
                {(errors.propiedadId || errors.propiedadNombre) && <div className="invalid-feedback d-block small">{errors.propiedadId || errors.propiedadNombre}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-semibold">Método de pago *</label>
                <select className={`form-select ${errors.metodoPago ? 'is-invalid' : ''}`} value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value as MetodoPagoVenta)}>
                  {METODOS_VENTA.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
                {errors.metodoPago && <div className="invalid-feedback d-block small">{errors.metodoPago}</div>}
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Precio final</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.precioFinal ? 'is-invalid' : ''}`} min={0} step={0.01} value={form.precioFinal} onChange={(e) => setField('precioFinal', e.target.value ? parseFloat(e.target.value) : 0)} />
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Descuento</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.descuento ? 'is-invalid' : ''}`} min={0} step={0.01} value={form.descuento ?? ''} onChange={(e) => setField('descuento', e.target.value ? parseFloat(e.target.value) : 0)} />
                </div>
                {errors.descuento && <div className="invalid-feedback d-block small">{errors.descuento}</div>}
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Impuestos</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className="form-control" min={0} step={0.01} value={form.impuestos ?? ''} onChange={(e) => setField('impuestos', e.target.value ? parseFloat(e.target.value) : 0)} />
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Total venta *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">S/</span>
                  <input type="number" className={`form-control ${errors.totalVenta ? 'is-invalid' : ''}`} min={0} step={0.01} value={form.totalVenta} onChange={(e) => setField('totalVenta', e.target.value ? parseFloat(e.target.value) : 0)} />
                </div>
                {errors.totalVenta && <div className="invalid-feedback d-block small">{errors.totalVenta}</div>}
                {!errors.totalVenta && <div className="form-text mt-0" style={{ fontSize: '.72rem' }}>Sugerido: {formatPEN(Math.max(0, Number(form.precioFinal ?? 0) - Number(form.descuento ?? 0) + Number(form.impuestos ?? 0)))}</div>}
              </div>

              <div className="col-12">
                <label className="form-label small fw-semibold">Observaciones</label>
                <textarea className="form-control" rows={2} value={form.observaciones || ''} onChange={(e) => setField('observaciones', e.target.value || null)} />
              </div>
              <div className="col-12">
                <div className="alert alert-light small py-2 mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle text-info" />
                  <div>IDs exactos son requeridos si usas la opción manual. La reserva debe estar ACTIVA.</div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {mode === 'create' ? 'Crear venta' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { http } from '@/lib/api';
async function http_post<T>(url: string, body: any) { return http.post<T>(url, body); }
async function http_patch<T>(url: string, body: any) { return http.patch<T>(url, body); }
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
