export type TipoNotificacion = 'SEGUIMIENTO_PENDIENTE' | 'VISITA_PROXIMA' | 'RESERVA_POR_VENCER' | 'TAREA_PENDIENTE';
export const TIPOS_NOTIFICACION: TipoNotificacion[] = ['SEGUIMIENTO_PENDIENTE', 'VISITA_PROXIMA', 'RESERVA_POR_VENCER', 'TAREA_PENDIENTE'];

export const NOTIFICACION_BADGE: Record<TipoNotificacion, string> = {
  SEGUIMIENTO_PENDIENTE: 'badge-soft-warning',
  VISITA_PROXIMA: 'badge-soft-info',
  RESERVA_POR_VENCER: 'badge-soft-danger',
  TAREA_PENDIENTE: 'badge-soft-primary',
};

export const NOTIFICACION_ICON: Record<TipoNotificacion, string> = {
  SEGUIMIENTO_PENDIENTE: 'bi bi-people-fill',
  VISITA_PROXIMA: 'bi bi-calendar-event-fill',
  RESERVA_POR_VENCER: 'bi bi-receipt-cutoff',
  TAREA_PENDIENTE: 'bi bi-check2-square',
};

export interface AsesorLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
}

export interface Notificacion {
  id: string;
  empresaId: string;
  asesorId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string | null;
  entidadId: string;
  entidadTipo: string;
  fechaNotificacion: string;
  leida: boolean;
  fechaLeida: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  asesor: AsesorLight;
}

export interface NotifPendientes {
  totalPendientes: number;
  porTipo: Record<string, number>;
}

export interface NotifPaginated {
  data: Notificacion[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface SincronizarNotifResult {
  creadas: number;
  actualizadas: number;
}

export interface FiltrosReporte {
  from: string;
  to: string;
  asesorId: string | null;
  clienteId: string | null;
  propiedadId: string | null;
}

export interface ReporteVentas {
  filtros: FiltrosReporte;
  resumen: { cantidad: number; totalVenta: string; totalPrecioFinal: string; totalSaldoPendiente: string; porEstado: Record<string, number> };
  filas: any[];
}
export interface ReporteClientes {
  filtros: FiltrosReporte;
  resumen: { totalActivos: number; nuevosEnPeriodo: number; porEstado: Record<string, number>; porMedioCaptacion: Record<string, number> };
  filas: any[];
}
export interface ReportePropiedades {
  filtros: FiltrosReporte;
  resumen: { totalPropiedades: number; valorTotalInventario: string; porEstado: Record<string, number>; porTipo: Record<string, number>; propiedadesVendidasEnPeriodo: number };
  filas: any[];
}
export interface ReporteVisitas {
  filtros: FiltrosReporte;
  resumen: { total: number; realizadas: number; tasaAsistenciaPorcentaje: number; porEstado: Record<string, number>; cantidadAsesoresConVisita: number };
  filas: any[];
}
export interface ReporteReservas {
  filtros: FiltrosReporte;
  resumen: { cantidad: number; totalMontoSeparacion: string; tasaConversionAVentaPorcentaje: number; porEstado: Record<string, number> };
  filas: any[];
}
export interface ReportePagos {
  filtros: FiltrosReporte;
  resumen: { cantidad: number; montoTotal: string; saldoPendienteTotal: string; porEstado: Record<string, number>; porMetodoPago: Record<string, number> };
  filas: any[];
}
export interface ReporteComisiones {
  filtros: FiltrosReporte;
  resumen: { cantidad: number; montoTotal: string; porEstado: Record<string, number>; porAsesor: { asesorId: string; nombres: string | null; apellidos: string | null; cantidad: number; monto: string }[] };
  filas: any[];
}
export interface ReporteRendimientoAsesores {
  filtros: FiltrosReporte;
  resumen: { cantidadAsesores: number; totalVentasCerradas: number; totalVendido: string; totalVisitas: number; ticketPromedioGlobal: string; totalComisiones: string };
  filas: {
    asesorId: string;
    nombres: string;
    apellidos: string;
    correo: string | null;
    telefono: string | null;
    pipelinesNuevos: number;
    visitasRealizadas: number;
    reservasHechas: number;
    ventasCerradas: number;
    totalVendido: string;
    ticketPromedio: string;
    comisionesCantidad: number;
    comisionesMonto: string;
    tasaConversionVisitaVentaPorcentaje: number;
  }[];
}

export interface ClienteReport {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  celular: string | null;
  numeroDocumento?: string | null;
}

export interface PropiedadReport {
  id: string;
  codigoInterno: string;
  nombre: string;
  estado: string;
  proyecto?: { id: string; nombre: string } | null;
}
