export type EstadoContrato = 'BORRADOR' | 'PENDIENTE_FIRMA' | 'FIRMADO' | 'VENCIDO' | 'ANULADO';
export const ESTADOS_CONTRATO: EstadoContrato[] = ['BORRADOR', 'PENDIENTE_FIRMA', 'FIRMADO', 'VENCIDO', 'ANULADO'];
export const CONTRATO_BADGE: Record<EstadoContrato, string> = {
  BORRADOR: 'badge-soft-secondary',
  PENDIENTE_FIRMA: 'badge-soft-warning',
  FIRMADO: 'badge-soft-success',
  VENCIDO: 'badge-soft-danger',
  ANULADO: 'badge-soft-light',
};

export type TipoContrato = 'COMPRAVENTA' | 'SEPARACION' | 'ADENDA' | 'OTRO';
export const TIPOS_CONTRATO: TipoContrato[] = ['COMPRAVENTA', 'SEPARACION', 'ADENDA', 'OTRO'];

export type EstadoComision = 'PENDIENTE' | 'APROBADA' | 'PAGADA' | 'ANULADA';
export const ESTADOS_COMISION: EstadoComision[] = ['PENDIENTE', 'APROBADA', 'PAGADA', 'ANULADA'];
export const COMISION_BADGE: Record<EstadoComision, string> = {
  PENDIENTE: 'badge-soft-warning',
  APROBADA: 'badge-soft-primary',
  PAGADA: 'badge-soft-success',
  ANULADA: 'badge-soft-secondary',
};

export interface ClienteLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  celular: string | null;
  numeroDocumento?: string | null;
}

export interface AsesorLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
}

export interface ResponsableLight {
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

export interface VentaLight {
  id: string;
  estado: string;
  fechaVenta: string;
  totalVenta: string;
  saldoPendiente?: string;
  precioFinal?: string;
  cliente?: ClienteLight;
  propiedad?: PropiedadLight;
}

export interface Contrato {
  id: string;
  empresaId: string;
  numeroContrato: string;
  version: number;
  ventaId: string;
  clienteId: string;
  propiedadId: string;
  responsableId: string;
  fechaEmision: string | null;
  fechaFirma: string | null;
  fechaVencimiento: string | null;
  estado: EstadoContrato;
  tipo: TipoContrato;
  montoContrato: string;
  observaciones: string | null;
  rutaPdfFirmado: string | null;
  hashDocumento: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  venta: VentaLight;
  cliente: ClienteLight;
  propiedad: PropiedadLight;
  responsable: ResponsableLight;
}

export interface Comision {
  id: string;
  empresaId: string;
  ventaId: string;
  asesorId: string;
  porcentajeComision: string;
  montoComision: string;
  estado: EstadoComision;
  fechaGeneracion: string | null;
  fechaPago: string | null;
  observaciones: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  asesor: AsesorLight;
  venta: {
    id: string;
    estado: string;
    fechaVenta: string;
    totalVenta: string;
    precioFinal?: string;
    cliente: ClienteLight;
    propiedad: PropiedadLight;
  };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateContratoInput {
  numeroContrato: string;
  version?: number;
  ventaId: string;
  clienteId: string;
  propiedadId: string;
  responsableId: string;
  fechaEmision?: string | null;
  fechaFirma?: string | null;
  fechaVencimiento?: string | null;
  estado?: EstadoContrato;
  tipo: TipoContrato;
  montoContrato: number;
  observaciones?: string | null;
  rutaPdfFirmado?: string | null;
  hashDocumento?: string | null;
}
export type UpdateContratoInput = Partial<CreateContratoInput>;

export interface FindContratosQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoContrato | '';
  tipo?: TipoContrato | '';
  ventaId?: string;
  clienteId?: string;
  propiedadId?: string;
  responsableId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fechaEmision' | 'fechaFirma' | 'montoContrato' | 'estado' | 'version';
  sortDirection?: 'asc' | 'desc';
}

export interface CreateComisionInput {
  ventaId: string;
  asesorId: string;
  porcentajeComision: number;
  montoComision: number;
  estado?: EstadoComision;
  fechaGeneracion?: string | null;
  fechaPago?: string | null;
  observaciones?: string | null;
}
export type UpdateComisionInput = Partial<CreateComisionInput>;

export interface FindComisionesQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoComision | '';
  ventaId?: string;
  asesorId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fechaGeneracion' | 'fechaPago' | 'montoComision' | 'porcentajeComision' | 'estado';
  sortDirection?: 'asc' | 'desc';
}
