'use client';

import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatPEN, getSession, http, humanizeToken, initials } from '@/lib/api';
import type { KpisOverview } from '@/lib/types';

interface KpiDef {
  key: string;
  label: string;
  icon: string;
  color: string;
  value: (k: KpisOverview) => React.ReactNode;
  trend?: (k: KpisOverview) => string | null;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KpisOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sess = getSession();
      if (!sess) return;
      try {
        const res = await http.get<KpisOverview>(
          `/empresas/${sess.usuario.empresaId}/dashboard/kpis/overview`,
        );
        if (!cancelled) setKpis(res.data);
      } catch (e) {
        const err = e as AxiosError<any>;
        if (!cancelled) setError(err.response?.data?.message ?? 'No se pudo cargar el dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpiCards: KpiDef[] = [
    {
      key: 'ventas-mes',
      label: 'Ventas del mes',
      icon: 'bi-cart-check',
      color: 'linear-gradient(135deg,#1f3c88,#3b5bca)',
      value: (k) => k.ventas.delMes,
      trend: () => null,
    },
    {
      key: 'clientes-nuevos',
      label: 'Clientes nuevos',
      icon: 'bi-person-plus',
      color: 'linear-gradient(135deg,#16a34a,#22c55e)',
      value: (k) => k.clientes.nuevos,
    },
    {
      key: 'clientes-pendientes',
      label: 'Clientes pendientes',
      icon: 'bi-people',
      color: 'linear-gradient(135deg,#ca8a04,#eab308)',
      value: (k) => k.clientes.pendientes,
    },
    {
      key: 'visitas-programadas',
      label: 'Visitas programadas',
      icon: 'bi-calendar-check',
      color: 'linear-gradient(135deg,#0891b2,#06b6d4)',
      value: (k) => k.visitas.programadas,
    },
    {
      key: 'reservas-activas',
      label: 'Reservas activas',
      icon: 'bi-bookmark-check',
      color: 'linear-gradient(135deg,#4f46e5,#6366f1)',
      value: (k) => k.reservas.activas,
    },
    {
      key: 'ventas-pagadas',
      label: 'Ventas pagadas',
      icon: 'bi-bag-check',
      color: 'linear-gradient(135deg,#15803d,#16a34a)',
      value: (k) => k.ventas.pagadas,
    },
    {
      key: 'total-vendido',
      label: 'Total vendido',
      icon: 'bi-currency-dollar',
      color: 'linear-gradient(135deg,#b45309,#f59e0b)',
      value: (k) => formatPEN(k.ventas.totalVendido),
    },
    {
      key: 'cobrado-mes',
      label: 'Monto cobrado',
      icon: 'bi-cash-stack',
      color: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
      value: (k) => formatPEN(k.pagos.montoCobrado),
    },
  ];

  const topAsesores = useMemo(() => kpis?.topAsesores ?? [], [kpis]);
  const maxVentas = useMemo(
    () => topAsesores.reduce((m, a) => Math.max(m, a.cantidadVentas), 1),
    [topAsesores],
  );

  return (
    <AppLayout>
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Resumen general de operaciones del periodo seleccionado.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <select className="form-select form-select-sm" defaultValue="MES">
            <option value="HOY">Hoy</option>
            <option value="SEM">Esta semana</option>
            <option value="MES">Este mes</option>
            <option value="TRIM">Este trimestre</option>
            <option value="ANIO">Este año</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-download me-1" /> Exportar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle me-2" /> {error}
        </div>
      )}

      <div className="row g-3 mb-4">
        {loading && !kpis
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card placeholder-glow">
                  <div className="kpi-icon rounded bg-secondary opacity-25" style={{ minWidth: 46, minHeight: 46 }} />
                  <div className="flex-1">
                    <div className="kpi-label placeholder rounded" style={{ width: 120, height: 14 }} />
                    <div className="kpi-value placeholder rounded mt-2" style={{ width: 140, height: 28 }} />
                  </div>
                </div>
              </div>
            ))
          : kpis &&
            kpiCards.map((k) => (
              <div key={k.key} className="col-12 col-sm-6 col-lg-3">
                <div className="kpi-card">
                  <div>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-value mt-1">{k.value(kpis)}</div>
                  </div>
                  <div className="kpi-icon" style={{ background: k.color }}>
                    <i className={`bi ${k.icon}`} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-4">
          <div className="section-card h-100">
            <div className="card-header">
              <h5 className="card-title">Ventas por estado</h5>
            </div>
            <div className="card-body">
              {kpis?.ventas.porEstado ? (
                <ul className="list-unstyled mb-0">
                  {Object.entries(kpis.ventas.porEstado).map(([k, v]) => (
                    <li key={k} className="mb-3 last:mb-0 d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge badge-soft-secondary text-uppercase fw-semibold" style={{ fontSize: '.7rem' }}>
                          {k}
                        </span>
                        <small className="text-muted">{humanizeToken(k)}</small>
                      </div>
                      <strong className="ms-auto">{v}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted small mb-0">Sin datos para mostrar.</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-4">
          <div className="section-card h-100">
            <div className="card-header">
              <h5 className="card-title">Pipeline por etapa</h5>
            </div>
            <div className="card-body">
              {kpis?.pipeline.porEtapa ? (
                Object.entries(kpis.pipeline.porEtapa).map(([k, v]) => (
                  <div key={k} className="mb-3">
                    <div className="d-flex justify-content-between align-items-center small mb-1">
                      <span className="fw-semibold">{humanizeToken(k)}</span>
                      <span className="text-muted">{v}</span>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                      <div
                        className="progress-bar bg-primary"
                        style={{
                          width: `${Math.min(100, (v / Math.max(kpis.clientes.total, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted small mb-0">Sin datos para mostrar.</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="section-card h-100">
            <div className="card-header">
              <h5 className="card-title">Pagos y comisiones</h5>
            </div>
            <div className="card-body">
              {kpis && (
                <div className="vstack gap-3">
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Pagos pendientes</span>
                    <span className="badge badge-soft-warning">{kpis.pagos.pendientes}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Pagos vencidos</span>
                    <span className="badge badge-soft-danger">{kpis.pagos.vencidos}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Saldo pendiente total</span>
                    <strong>{formatPEN(kpis.pagos.saldoPendienteTotal)}</strong>
                  </div>
                  <hr className="my-1" />
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Comisiones pendientes</span>
                    <span className="badge badge-soft-secondary">{kpis.comisiones.cantidadPendientes}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Monto comisiones pendientes</span>
                    <strong>{formatPEN(kpis.comisiones.montoPendiente)}</strong>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Comisiones pagadas (periodo)</span>
                    <span className="badge badge-soft-success">{kpis.comisiones.cantidadPagadas}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-muted">Monto pagado (periodo)</span>
                    <strong>{formatPEN(kpis.comisiones.montoPagado)}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="section-card">
            <div className="card-header">
              <h5 className="card-title">Top asesores del periodo</h5>
              <button className="btn btn-sm btn-outline-primary">Ver todos</button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Asesor</th>
                    <th>Ventas</th>
                    <th>Progreso</th>
                    <th className="text-end">Monto vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {topAsesores.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4 small">
                        No hay datos de asesores en este periodo.
                      </td>
                    </tr>
                  )}
                  {topAsesores.map((a, i) => {
                    const pct = Math.round((a.cantidadVentas / maxVentas) * 100);
                    return (
                      <tr key={a.asesorId}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <span className="avatar-sm text-bg-primary">
                              {initials(a.nombres || 'A', a.apellidos || null)}
                            </span>
                            <div>
                              <div className="fw-semibold small lh-1">
                                {a.nombres} {a.apellidos}
                              </div>
                              <div className="text-muted small">{a.correo}</div>
                            </div>
                            {i === 0 && (
                              <span className="badge badge-soft-warning ms-auto">
                                <i className="bi bi-trophy-fill me-1" /> #1
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <strong>{a.cantidadVentas}</strong>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: 8 }}>
                              <div
                                className="progress-bar bg-success"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-muted small">{pct}%</span>
                          </div>
                        </td>
                        <td className="text-end fw-semibold">
                          {formatPEN(a.totalVendido)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="section-card h-100">
            <div className="card-header">
              <h5 className="card-title">Propiedades & Clientes</h5>
            </div>
            <div className="card-body">
              {kpis && (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <div className="border rounded-3 p-3">
                        <div className="small text-muted">Total clientes</div>
                        <div className="h4 fw-bold mb-0">{kpis.clientes.total}</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="border rounded-3 p-3">
                        <div className="small text-muted">Total propiedades</div>
                        <div className="h4 fw-bold mb-0">{kpis.propiedades.total}</div>
                      </div>
                    </div>
                  </div>

                  <h6 className="small text-uppercase text-muted mb-2">
                    Propiedades por estado
                  </h6>
                  <div className="vstack gap-2 mb-4">
                    {Object.entries(kpis.propiedades.porEstado).map(([k, v]) => (
                      <div key={k} className="d-flex justify-content-between align-items-center small">
                        <span className="fw-semibold">{humanizeToken(k)}</span>
                        <span className="badge badge-soft-info">{v}</span>
                      </div>
                    ))}
                  </div>

                  <h6 className="small text-uppercase text-muted mb-2">
                    Visitas por estado
                  </h6>
                  <div className="vstack gap-2">
                    {Object.entries(kpis.visitas.porEstado).map(([k, v]) => (
                      <div key={k} className="d-flex justify-content-between align-items-center small">
                        <span className="fw-semibold">{humanizeToken(k)}</span>
                        <span className="badge badge-soft-success">{v}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
