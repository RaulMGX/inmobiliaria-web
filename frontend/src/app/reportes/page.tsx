'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDate, formatPEN, getSession, http } from '@/lib/api';
import {
  AsesorLight,
  ClienteReport,
  PropiedadReport,
  ReporteClientes,
  ReporteComisiones,
  ReportePagos,
  ReportePropiedades,
  ReporteRendimientoAsesores,
  ReporteReservas,
  ReporteVentas,
  ReporteVisitas,
} from '@/lib/reportes-notificaciones';

function toDateInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toISOInputDay(s: string): string {
  if (!s) return '';
  return toDateInput(new Date(s));
}
function atStart(s: string): string { if (!s) return ''; return new Date(s + 'T00:00:00.000').toISOString(); }
function atEnd(s: string): string { if (!s) return ''; return new Date(s + 'T23:59:59.999').toISOString(); }

function defaultFrom(): Date { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }
function defaultTo(): Date { return new Date(); }

export default function ReportesPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';

  const [filters, setFilters] = useState({
    from: toDateInput(defaultFrom()),
    to: toDateInput(defaultTo()),
    asesorId: '',
    clienteId: '',
    propiedadId: '',
    limit: 100,
  });

  const [clientes, setClientes] = useState<ClienteReport[]>([]);
  const [asesores, setAsesores] = useState<AsesorLight[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadReport[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ventas, setVentas] = useState<ReporteVentas | null>(null);
  const [clientesR, setClientesR] = useState<ReporteClientes | null>(null);
  const [propiedadesR, setPropiedadesR] = useState<ReportePropiedades | null>(null);
  const [visitasR, setVisitasR] = useState<ReporteVisitas | null>(null);
  const [reservasR, setReservasR] = useState<ReporteReservas | null>(null);
  const [pagosR, setPagosR] = useState<ReportePagos | null>(null);
  const [comisionesR, setComisionesR] = useState<ReporteComisiones | null>(null);
  const [ranking, setRanking] = useState<ReporteRendimientoAsesores | null>(null);

  const fetchAll = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true); setError(null);
    const params: any = { limit: filters.limit };
    if (filters.from) params.from = atStart(filters.from);
    if (filters.to) params.to = atEnd(filters.to);
    if (filters.asesorId) params.asesorId = filters.asesorId;
    if (filters.clienteId) params.clienteId = filters.clienteId;
    if (filters.propiedadId) params.propiedadId = filters.propiedadId;

    const base = `/empresas/${empresaId}/reportes`;
    try {
      const out = await Promise.all([
        http.get<ReporteVentas>(`${base}/ventas`, { params }),
        http.get<ReporteClientes>(`${base}/clientes`, { params }),
        http.get<ReportePropiedades>(`${base}/propiedades`, { params }),
        http.get<ReporteVisitas>(`${base}/visitas`, { params }),
        http.get<ReporteReservas>(`${base}/reservas`, { params }),
        http.get<ReportePagos>(`${base}/pagos`, { params }),
        http.get<ReporteComisiones>(`${base}/comisiones`, { params }),
        http.get<ReporteRendimientoAsesores>(`${base}/rendimiento-asesores`, { params }),
      ]);
      setVentas(out[0].data); setClientesR(out[1].data); setPropiedadesR(out[2].data);
      setVisitasR(out[3].data); setReservasR(out[4].data); setPagosR(out[5].data);
      setComisionesR(out[6].data); setRanking(out[7].data);

      const cc = new Map<string, ClienteReport>();
      const aa = new Map<string, AsesorLight>();
      const pp = new Map<string, PropiedadReport>();

      out[0].data.filas.forEach((v: any) => { if (v.cliente) cc.set(v.cliente.id, v.cliente); if (v.asesor) aa.set(v.asesor.id, v.asesor); if (v.propiedad) pp.set(v.propiedad.id, v.propiedad); });
      out[1].data.filas.forEach((c: any) => cc.set(c.id, { id: c.id, nombres: c.nombres, apellidos: c.apellidos, correo: c.correo || null, celular: c.celular || null, numeroDocumento: c.numeroDocumento || null }));
      out[2].data.filas.forEach((p: any) => pp.set(p.id, { id: p.id, codigoInterno: p.codigoInterno, nombre: p.nombre, estado: p.estado, proyecto: p.proyecto || null }));
      out[3].data.filas.forEach((v: any) => { if (v.cliente) cc.set(v.cliente.id, v.cliente); if (v.asesor) aa.set(v.asesor.id, v.asesor); if (v.propiedad) pp.set(v.propiedad.id, v.propiedad); });
      out[4].data.filas.forEach((r: any) => { if (r.cliente) cc.set(r.cliente.id, r.cliente); if (r.asesor) aa.set(r.asesor.id, r.asesor); if (r.propiedad) pp.set(r.propiedad.id, r.propiedad); });
      out[5].data.filas.forEach((p: any) => { if (p.venta?.cliente) cc.set(p.venta.cliente.id, p.venta.cliente); if (p.venta?.propiedad) pp.set(p.venta.propiedad.id, p.venta.propiedad); if (p.registradoPor) aa.set(p.registradoPor.id, p.registradoPor); });
      out[6].data.filas.forEach((c: any) => { if (c.asesor) aa.set(c.asesor.id, c.asesor); if (c.venta?.cliente) cc.set(c.venta.cliente.id, c.venta.cliente); if (c.venta?.propiedad) pp.set(c.venta.propiedad.id, c.venta.propiedad); });
      out[7].data.filas.forEach((a: any) => aa.set(a.asesorId, { id: a.asesorId, nombres: a.nombres, apellidos: a.apellidos, correo: a.correo || null }));

      setClientes(Array.from(cc.values()));
      setAsesores(Array.from(aa.values()));
      setPropiedades(Array.from(pp.values()));
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar los reportes.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, filters]);

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  const periodLabel = useMemo(() => `${toISOInputDay(filters.from) || '—'} → ${toISOInputDay(filters.to) || '—'}`, [filters.from, filters.to]);

  const topAsesores = ranking?.filas?.slice(0, 5) ?? [];

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Consolida métricas de ventas, clientes, propiedades, visitas, reservas, pagos, comisiones y rendimiento de asesores.</p>
        </div>
        <div className="d-flex gap-2">
          <div className="text-muted small align-self-center">Periodo: <span className="fw-semibold">{periodLabel}</span></div>
          <button className="btn btn-sm btn-primary d-flex align-items-center gap-2" onClick={fetchAll} disabled={loading}>
            {loading && <span className="spinner-border spinner-border-sm me-1" />}
            <i className="bi bi-arrow-clockwise" /> Actualizar
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger small mb-4 d-flex align-items-start gap-2 py-2" role="alert"><i className="bi bi-exclamation-triangle-fill mt-1" /><div>{error}</div></div>}

      <div className="section-card mb-4">
        <div className="card-header"><h5 className="card-title"><i className="bi bi-funnel me-2 text-primary" /> Filtros</h5></div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold">Desde</label>
              <input type="date" className="form-control" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold">Hasta</label>
              <input type="date" className="form-control" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">Asesor</label>
              <select className="form-select" value={filters.asesorId} onChange={(e) => setFilters((f) => ({ ...f, asesorId: e.target.value }))}>
                <option value="">Todos</option>
                {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">Cliente</label>
              <select className="form-select" value={filters.clienteId} onChange={(e) => setFilters((f) => ({ ...f, clienteId: e.target.value }))}>
                <option value="">Todos</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">Propiedad</label>
              <select className="form-select" value={filters.propiedadId} onChange={(e) => setFilters((f) => ({ ...f, propiedadId: e.target.value }))}>
                <option value="">Todas</option>
                {propiedades.map((p) => <option key={p.id} value={p.id}>[{p.codigoInterno}] {p.nombre}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-12 d-flex gap-2 justify-content-end">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setFilters({ from: toDateInput(defaultFrom()), to: toDateInput(defaultTo()), asesorId: '', clienteId: '', propiedadId: '', limit: 100 })}>
                <i className="bi bi-arrow-counterclockwise me-1" /> Limpiar
              </button>
              <button className="btn btn-sm btn-success" onClick={fetchAll} disabled={loading}>
                <i className="bi bi-search me-1" /> Consultar
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && !ventas && (
        <div className="section-card"><div className="card-body text-center py-5 text-muted"><div className="spinner-border me-2" /> Cargando reportes...</div></div>
      )}

      {!loading && ventas && (
        <>
          <div className="row g-3 mb-4">
            <KPICard icon="bi-bag-check" color="#eef2ff|#3730a3" label="Ventas pág." value={`${ventas.resumen.cantidad}`} sub={formatPEN(ventas.resumen.totalVenta)} />
            <KPICard icon="bi-cash-coin" color="#dcfce7|#166534" label="Pagos cobrados" value={`${pagosR?.resumen.cantidad ?? 0}`} sub={formatPEN(pagosR?.resumen.montoTotal ?? '0')} />
            <KPICard icon="bi-people-fill" color="#fef3c7|#92400e" label="Clientes nuevos" value={`${clientesR?.resumen.nuevosEnPeriodo ?? 0}`} sub={`${clientesR?.resumen.totalActivos ?? 0} activos`} />
            <KPICard icon="bi-calendar-event-fill" color="#d1fae5|#065f46" label="Visitas / asistencia" value={`${visitasR?.resumen.total ?? 0}`} sub={`${visitasR?.resumen.tasaAsistenciaPorcentaje ?? 0}% asistencia`} />
            <KPICard icon="bi-receipt-cutoff" color="#fee2e2|#991b1b" label="Reservas" value={`${reservasR?.resumen.cantidad ?? 0}`} sub={`${reservasR?.resumen.tasaConversionAVentaPorcentaje ?? 0}% conversión`} />
            <KPICard icon="bi-wallet2" color="#fce7f3|#9d174d" label="Comisiones" value={`${comisionesR?.resumen.cantidad ?? 0}`} sub={formatPEN(comisionesR?.resumen.montoTotal ?? '0')} />
            <KPICard icon="bi-graph-up-arrow" color="#e0e7ff|#3730a3" label="Propiedades" value={`${propiedadesR?.resumen.totalPropiedades ?? 0}`} sub={`${propiedadesR?.resumen.propiedadesVendidasEnPeriodo ?? 0} vendidas`} />
            <KPICard icon="bi-person-check-fill" color="#fef9c3|#713f12" label="Asesores activos" value={`${ranking?.resumen.cantidadAsesores ?? 0}`} sub={formatPEN(ranking?.resumen.totalVendido ?? '0') + ' vendido'} />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="section-card h-100">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                  <h5 className="card-title"><i className="bi bi-award me-2 text-warning" /> Top asesores</h5>
                  <span className="text-muted small" style={{ fontSize: '.78rem' }}>Ranking por total vendido</span>
                </div>
                <div className="card-body p-0">
                  {topAsesores.length === 0 ? (
                    <div className="py-4 text-center text-muted small">Sin datos en el periodo.</div>
                  ) : (
                    <ol className="list-group list-group-flush mb-0">
                    {topAsesores.map((a, i) => {
                      const total = Number(a.totalVendido);
                      const top = Number(ranking?.resumen.totalVendido || 0);
                      const pct = top > 0 ? Math.min(100, Math.round((Number(total) / top) * 100)) : 0;
                      return (
                        <li key={a.asesorId} className="list-group-item border-0 px-3 py-2">
                          <div className="d-flex align-items-center justify-content-between mb-1 gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge rounded-pill" style={{ width: 24, height: 24, background: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? '#f59e0b' : '#e5e7eb', color: i < 3 ? '#ffffff' : '#111827', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem' }}>{i + 1}</span>
                              <span className="fw-semibold small">{a.nombres} {a.apellidos}</span>
                            </div>
                            <div className="text-end">
                              <div className="fw-bold text-primary">{formatPEN(a.totalVendido)}</div>
                              <div className="text-muted small" style={{ fontSize: '.75rem' }}>{a.ventasCerradas} ventas · {formatPEN(a.ticketPromedio)} ticket</div>
                            </div>
                          </div>
                          <div className="progress" style={{ height: 6 }}>
                            <div className="progress-bar bg-primary" style={{ width: pct + '%' }} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="section-card h-100">
                <div className="card-header"><h5 className="card-title"><i className="bi bi-pie-chart me-2 text-success" /> Desglose rápido</h5></div>
                <div className="card-body p-0">
                  <div className="row g-0 m-0">
                    <Mini title="Ventas por estado">
                      <h6 className="fw-semibold small text-uppercase text-muted px-3 pt-3 pb-1 mb-0">Ventas · Estados</h6>
                      <div className="d-flex flex-wrap gap-2 p-3 pt-2">
                        {Object.entries(ventas.resumen.porEstado || {}).length === 0 && <div className="text-muted small px-3">Sin datos.</div>}
                        {Object.entries(ventas.resumen.porEstado || {}).map(([k, v]) => (
                          <span key={k} className="badge badge-soft-primary px-2 py-1 fw-semibold"><span className="me-1">{k.replace(/_/g, ' ')}</span><span className="fw-bold">{v}</span></span>
                        ))}
                      </div>
                    </Mini>
                    <Mini title="Pagos · métodos">
                      <h6 className="fw-semibold small text-uppercase text-muted px-3 pt-3 pb-1 mb-0">Pagos · Métodos</h6>
                      <div className="d-flex flex-wrap gap-2 p-3 pt-2">
                        {Object.entries(pagosR?.resumen.porMetodoPago || {}).length === 0 && <div className="text-muted small px-3">Sin datos.</div>}
                        {Object.entries(pagosR?.resumen.porMetodoPago || {}).map(([k, v]) => (
                          <span key={k} className="badge badge-soft-success px-2 py-1 fw-semibold"><span className="me-1">{k.replace(/_/g, ' ')}</span><span className="fw-bold">{v}</span></span>
                        ))}
                      </div>
                    </Mini>
                    <Mini title="Clientes · medio captación">
                      <h6 className="fw-semibold small text-uppercase text-muted px-3 pt-3 pb-1 mb-0">Clientes · Medio captación</h6>
                      <div className="d-flex flex-wrap gap-2 p-3 pt-2">
                        {Object.entries(clientesR?.resumen.porMedioCaptacion || {}).length === 0 && <div className="text-muted small px-3">Sin datos.</div>}
                        {Object.entries(clientesR?.resumen.porMedioCaptacion || {}).map(([k, v]) => (
                          <span key={k} className="badge badge-soft-warning px-2 py-1 fw-semibold"><span className="me-1">{k.replace(/_/g, ' ')}</span><span className="fw-bold">{v}</span></span>
                        ))}
                      </div>
                    </Mini>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <SectionTable title="Ventas" subtitle={`${ventas.resumen.cantidad} ventas · ${formatPEN(ventas.resumen.totalVenta)}`} icon="bi-bag-check" color="primary">
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Propiedad</th><th>Estado</th><th className="text-end">Total</th><th className="text-end">Saldo</th></tr>
            </thead>
            <tbody>
              {ventas.filas.length === 0 && <tr><td colSpan={7} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
              {ventas.filas.map((v: any) => <tr key={v.id}>
                <td className="small">{formatDate(v.fechaVenta)}</td>
                <td className="small">{v.cliente?.nombres} {v.cliente?.apellidos}</td>
                <td className="small">{v.asesor?.nombres} {v.asesor?.apellidos}</td>
                <td className="small">[{v.propiedad?.codigoInterno}] {v.propiedad?.nombre}</td>
                <td><span className="badge badge-soft-primary fw-semibold" style={{ fontSize: '.7rem' }}>{v.estado?.replace(/_/g, ' ')}</span></td>
                <td className="text-end fw-semibold">{formatPEN(v.totalVenta)}</td>
                <td className={`text-end fw-bold ${parseFloat(v.saldoPendiente || '0') > 0 ? 'text-danger' : 'text-success'}`}>{formatPEN(v.saldoPendiente || '0')}</td>
              </tr>)}
            </tbody>
          </SectionTable>

          <SectionTable title="Clientes" subtitle={`${clientesR?.resumen.nuevosEnPeriodo ?? 0} nuevos · ${clientesR?.resumen.totalActivos ?? 0} activos`} icon="bi-people" color="warning">
            <thead>
              <tr><th>Cliente</th><th>Documento</th><th>Contacto</th><th>Medio</th><th>Estado</th><th className="text-end">Visitas</th><th className="text-end">Ventas</th><th className="text-end">Total comprado</th></tr>
            </thead>
            <tbody>
              {(clientesR?.filas ?? []).length === 0 && <tr><td colSpan={8} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
              {(clientesR?.filas ?? []).map((c: any) => <tr key={c.id}>
                <td className="small">{c.nombres} {c.apellidos}</td>
                <td className="small" style={{ fontFamily: 'monospace' }}>{c.numeroDocumento || '—'}</td>
                <td className="small">{c.celular || c.correo || '—'}</td>
                <td><span className="badge badge-soft-warning fw-semibold" style={{ fontSize: '.65rem' }}>{c.medioCaptacion?.replace(/_/g, ' ') || '—'}</span></td>
                <td><span className="badge badge-soft-primary fw-semibold" style={{ fontSize: '.65rem' }}>{c.estado?.replace(/_/g, ' ') || '—'}</span></td>
                <td className="text-end small">{c.visitasEnPeriodo ?? 0}</td>
                <td className="text-end small">{c.ventasEnPeriodo ?? 0}</td>
                <td className="text-end fw-semibold">{formatPEN(c.totalCompradoEnPeriodo || '0')}</td>
              </tr>)}
            </tbody>
          </SectionTable>

          <SectionTable title="Propiedades" subtitle={`${propiedadesR?.resumen.totalPropiedades ?? 0} · Inventario ${formatPEN(propiedadesR?.resumen.valorTotalInventario || '0')}`} icon="bi-house-door-fill" color="info">
            <thead>
              <tr><th>Propiedad</th><th>Proyecto</th><th>Tipo</th><th>Estado</th><th className="text-end">Precio</th><th className="text-end">Ventas pág.</th><th className="text-end">Monto vendido</th></tr>
            </thead>
            <tbody>
              {(propiedadesR?.filas ?? []).length === 0 && <tr><td colSpan={7} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
              {(propiedadesR?.filas ?? []).map((p: any) => <tr key={p.id}>
                <td className="small">[{p.codigoInterno}] {p.nombre}</td>
                <td className="small">{p.proyecto?.nombre || '—'}</td>
                <td className="small">{p.tipoPropiedad?.replace(/_/g, ' ') || '—'}</td>
                <td><span className="badge badge-soft-info fw-semibold" style={{ fontSize: '.65rem' }}>{p.estado?.replace(/_/g, ' ') || '—'}</span></td>
                <td className="text-end small">{p.precio ? formatPEN(p.precio) : '—'}</td>
                <td className="text-end small">{p.ventasEnPeriodo ?? 0}</td>
                <td className="text-end fw-semibold">{formatPEN(p.montoVendidoEnPeriodo || '0')}</td>
              </tr>)}
            </tbody>
          </SectionTable>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
            <SectionTable title="Visitas" subtitle={`${visitasR?.resumen.total ?? 0} · ${visitasR?.resumen.tasaAsistenciaPorcentaje ?? 0}% asistencia`} icon="bi-calendar-event" color="info">
              <thead>
                <tr><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Propiedad</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {(visitasR?.filas ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
                {(visitasR?.filas ?? []).slice(0, 8).map((v: any) => <tr key={v.id}>
                  <td className="small">{formatDate(v.fechaHora)}</td>
                  <td className="small">{v.cliente?.nombres} {v.cliente?.apellidos}</td>
                  <td className="small">{v.asesor?.nombres} {v.asesor?.apellidos}</td>
                  <td className="small">[{v.propiedad?.codigoInterno}]</td>
                  <td><span className="badge badge-soft-info fw-semibold" style={{ fontSize: '.65rem' }}>{v.estado?.replace(/_/g, ' ')}</span></td>
                </tr>)}
              </tbody>
            </SectionTable>
            </div>
            <div className="col-md-6">
            <SectionTable title="Reservas" subtitle={`${reservasR?.resumen.cantidad ?? 0} · ${reservasR?.resumen.tasaConversionAVentaPorcentaje ?? 0}% conversión`} icon="bi-receipt-cutoff" color="danger">
              <thead>
                <tr><th>Reserva</th><th>Cliente</th><th>Asesor</th><th>Estado</th><th className="text-end">Separación</th></tr>
              </thead>
              <tbody>
                {(reservasR?.filas ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
                {(reservasR?.filas ?? []).slice(0, 8).map((r: any) => <tr key={r.id}>
                  <td className="small" style={{ fontFamily: 'monospace' }}>{r.id.slice(0, 8)}…</td>
                  <td className="small">{r.cliente?.nombres} {r.cliente?.apellidos}</td>
                  <td className="small">{r.asesor?.nombres} {r.asesor?.apellidos}</td>
                  <td><span className="badge badge-soft-danger fw-semibold" style={{ fontSize: '.65rem' }}>{r.estado?.replace(/_/g, ' ')}</span></td>
                  <td className="text-end fw-semibold">{formatPEN(r.montoSeparacion || '0')}</td>
                </tr>)}
              </tbody>
            </SectionTable>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
            <SectionTable title="Pagos" subtitle={`${pagosR?.resumen.cantidad ?? 0} · saldo ${formatPEN(pagosR?.resumen.saldoPendienteTotal ?? '0')}`} icon="bi-cash-stack" color="success">
              <thead><tr><th>Pago</th><th>Cliente</th><th>Método</th><th>Estado</th><th className="text-end">Monto</th></tr></thead>
              <tbody>
                {(pagosR?.filas ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
                {(pagosR?.filas ?? []).slice(0, 8).map((p: any) => <tr key={p.id}>
                  <td className="small" style={{ fontFamily: 'monospace' }}>{p.id.slice(0, 8)}…</td>
                  <td className="small">{p.venta?.cliente?.nombres} {p.venta?.cliente?.apellidos}</td>
                  <td className="small">{p.metodoPago?.replace(/_/g, ' ') || '—'}</td>
                  <td><span className="badge badge-soft-success fw-semibold" style={{ fontSize: '.65rem' }}>{p.estado?.replace(/_/g, ' ')}</span></td>
                  <td className="text-end fw-semibold">{formatPEN(p.monto || '0')}</td>
                </tr>)}
              </tbody>
            </SectionTable>
            </div>
            <div className="col-md-6">
            <SectionTable title="Comisiones" subtitle={`${comisionesR?.resumen.cantidad ?? 0} · ${formatPEN(comisionesR?.resumen.montoTotal ?? '0')}`} icon="bi-wallet2" color="primary">
              <thead><tr><th>Asesor</th><th>Cliente (venta)</th><th>%</th><th>Estado</th><th className="text-end">Monto</th></tr></thead>
              <tbody>
                {(comisionesR?.filas ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
                {(comisionesR?.filas ?? []).slice(0, 8).map((c: any) => <tr key={c.id}>
                  <td className="small">{c.asesor?.nombres} {c.asesor?.apellidos}</td>
                  <td className="small">{c.venta?.cliente?.nombres} {c.venta?.cliente?.apellidos}</td>
                  <td className="small">{c.porcentajeComision ?? '—'}%</td>
                  <td><span className="badge badge-soft-primary fw-semibold" style={{ fontSize: '.65rem' }}>{c.estado?.replace(/_/g, ' ')}</span></td>
                  <td className="text-end fw-semibold">{formatPEN(c.montoComision || '0')}</td>
                </tr>)}
              </tbody>
            </SectionTable>
            </div>
          </div>

          <SectionTable title="Ranking completo de asesores" subtitle={`${ranking?.resumen.cantidadAsesores ?? 0} asesores · Ticket prom. ${formatPEN(ranking?.resumen.ticketPromedioGlobal ?? '0')}`} icon="bi-trophy-fill" color="warning">
            <thead>
              <tr>
              <th>Asesor</th><th className="text-end">Pipelines</th><th className="text-end">Visitas</th><th className="text-end">Reservas</th><th className="text-end">Ventas</th><th className="text-end">Vendido</th><th className="text-end">Ticket</th><th className="text-end">Comisión</th><th className="text-end">Conversión</th>
            </tr></thead>
            <tbody>
              {(ranking?.filas ?? []).length === 0 && <tr><td colSpan={9} className="text-center py-3 text-muted small">Sin resultados.</td></tr>}
              {(ranking?.filas ?? []).map((a, i) => <tr key={a.asesorId}>
                <td className="small"><span className="fw-semibold me-1">{i + 1}.</span>{a.nombres} {a.apellidos}{a.telefono ? ` · ${a.telefono}` : ''}</td>
                <td className="text-end small">{a.pipelinesNuevos}</td>
                <td className="text-end small">{a.visitasRealizadas}</td>
                <td className="text-end small">{a.reservasHechas}</td>
                <td className="text-end small fw-semibold">{a.ventasCerradas}</td>
                <td className="text-end fw-bold text-primary">{formatPEN(a.totalVendido)}</td>
                <td className="text-end small">{formatPEN(a.ticketPromedio)}</td>
                <td className="text-end small">{a.comisionesCantidad} · {formatPEN(a.comisionesMonto)}</td>
                <td className="text-end small">{a.tasaConversionVisitaVentaPorcentaje}%</td>
              </tr>)}
            </tbody>
          </SectionTable>
        </>
      )}
    </AppLayout>
  );
}

function KPICard({ icon, color, label, value, sub }: { icon: string; color: string; label: string; value: string; sub?: string }) {
  const [bg, fg] = color.split('|');
  return (
    <div className="col-6 col-md-3 col-lg-3">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body p-3 d-flex align-items-center gap-3">
          <div className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`bi ${icon} fs-5`} />
          </div>
          <div className="flex-grow-1 min-w-0">
            <div className="text-muted small text-ellipsis" style={{ fontSize: '.78rem' }}>{label}</div>
            <div className="fw-bold fs-5 text-truncate">{value}</div>
            {sub && <div className="text-muted small text-truncate" style={{ fontSize: '.75rem' }}>{sub}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ children }: { title: string; children: React.ReactNode }) {
  return <div className="col-md-12">{children}</div>;
}

function SectionTable({ title, subtitle, icon, color, children }: { title: string; subtitle?: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div className="section-card mb-4">
      <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h5 className="card-title"><i className={`bi ${icon} me-2 text-${color}`} /> {title}</h5>
        {subtitle && <div className="text-muted small" style={{ fontSize: '.8rem' }}>{subtitle}</div>}
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle small">
          {children}
        </table>
      </div>
    </div>
  );
}
