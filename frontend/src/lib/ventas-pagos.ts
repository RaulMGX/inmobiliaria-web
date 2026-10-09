export type EstadoVenta =
  | 'PENDIENTE_FORMALIZACION'
  | 'FORMALIZADA'
  | 'PAGADA'
  | 'ANULADA';

export const ESTADOS_VENTA: EstadoVenta[] = [
  'PENDIENTE_FORMALIZACION',
  'FORMALIZADA',
  'PAGADA',
  'ANULADA',
];

export const VENTA_BADGE: Record<EstadoVenta, string> = {
  PENDIENTE_FORMALIZACION: 'badge-soft-warning',
  FORMALIZADA: 'badge-soft-primary',
  PAGADA: 'badge-soft-success',
  ANULADA: 'badge-soft-secondary',
};

export type MetodoPagoVenta =
  | 'CONTADO'
  | 'CREDITO_HIPOTECARIO'
  | 'FINANCIAMIENTO_DIRECTO'
  | 'MIXTO'
  | 'OTRO';

export const METODOS_VENTA: MetodoPagoVenta[] = [
  'CONTADO',
  'CREDITO_HIPOTECARIO',
  'FINANCIAMIENTO_DIRECTO',
  'MIXTO',
  'OTRO',
];

export type EstadoPago = 'PENDIENTE' | 'VENCIDO' | 'PAGADO' | 'ANULADO';

export const ESTADOS_PAGO: EstadoPago[] = ['PENDIENTE', 'VENCIDO', 'PAGADO', 'ANULADO'];

export const PAGO_BADGE: Record<EstadoPago, string> = {
  PENDIENTE: 'badge-soft-warning',
  VENCIDO: 'badge-soft-danger',
  PAGADO: 'badge-soft-success',
  ANULADO: 'badge-soft-secondary',
};

export type MetodoPagoPago =
  | 'EFECTIVO'
  | 'TRANSFERENCIA_BANCARIA'
  | 'DEPOSITO'
  | 'TARJETA'
  | 'CHEQUE'
  | 'YAPE'
  | 'PLIN'
  | 'OTRO';

export const METODOS_PAGO: MetodoPagoPago[] = [
  'EFECTIVO',
  'TRANSFERENCIA_BANCARIA',
  'DEPOSITO',
  'TARJETA',
  'CHEQUE',
  'YAPE',
  'PLIN',
  'OTRO',
];

export interface ClienteLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  celular: string | null;
}

export interface AsesorLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
}

export interface ProyectoLight {
  id: string;
  nombre: string;
}

export interface PropiedadLight {
  id: string;
  codigoInterno: string;
  nombre: string;
  estado: string;
  proyecto?: ProyectoLight | null;
}

export interface ReservaLight {
  id: string;
  estado: string;
  fechaReserva: string;
  fechaVencimiento: string;
  montoSeparacion: string;
}

export interface Venta {
  id: string;
  empresaId: string;
  reservaId: string;
  clienteId: string;
  propiedadId: string;
  asesorId: string;
  estado: EstadoVenta;
  metodoPago: MetodoPagoVenta;
  fechaVenta: string;
  precioFinal: string;
  descuento: string;
  impuestos: string | null;
  totalVenta: string;
  saldoPendiente: string;
  observaciones: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cliente: ClienteLight;
  propiedad: PropiedadLight;
  reserva: ReservaLight;
  asesor: AsesorLight;
}

export interface PagoVentaLight {
  id: string;
  estado: EstadoVenta;
  fechaVenta: string;
  totalVenta: string;
  saldoPendiente: string;
  cliente: ClienteLight;
  asesor: AsesorLight;
  propiedad: PropiedadLight;
}

export interface Pago {
  id: string;
  empresaId: string;
  ventaId: string;
  numeroCuota: number | null;
  fechaVencimiento: string | null;
  fechaPago: string | null;
  monto: string;
  saldo: string;
  estado: EstadoPago;
  metodoPago: MetodoPagoPago | null;
  numeroOperacion: string | null;
  observaciones: string | null;
  registradoPorId: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  venta: PagoVentaLight;
  registradoPor: AsesorLight | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateVentaInput {
  reservaId: string;
  clienteId: string;
  propiedadId: string;
  asesorId: string;
  estado?: EstadoVenta;
  metodoPago: MetodoPagoVenta;
  fechaVenta?: string | null;
  precioFinal: number;
  descuento?: number | null;
  impuestos?: number | null;
  totalVenta: number;
  observaciones?: string | null;
}

export type UpdateVentaInput = Partial<CreateVentaInput>;

export interface FindVentasQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoVenta | '';
  metodoPago?: MetodoPagoVenta | '';
  clienteId?: string;
  propiedadId?: string;
  reservaId?: string;
  asesorId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fechaVenta' | 'totalVenta' | 'estado';
  sortDirection?: 'asc' | 'desc';
}

export interface CreatePagoInput {
  ventaId: string;
  numeroCuota?: number | null;
  fechaVencimiento?: string | null;
  fechaPago?: string | null;
  monto: number;
  estado?: EstadoPago;
  metodoPago?: MetodoPagoPago | null;
  numeroOperacion?: string | null;
  observaciones?: string | null;
  registradoPorId?: string | null;
}

export type UpdatePagoInput = Partial<CreatePagoInput>;

export interface FindPagosQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoPago | '';
  metodoPago?: MetodoPagoPago | '';
  ventaId?: string;
  clienteId?: string;
  registradoPorId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fechaPago' | 'fechaVencimiento' | 'monto' | 'estado';
  sortDirection?: 'asc' | 'desc';
}
