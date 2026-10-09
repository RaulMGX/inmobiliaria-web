export type EstadoVisita =
  | 'PROGRAMADA'
  | 'CONFIRMADA'
  | 'REPROGRAMADA'
  | 'REALIZADA'
  | 'CANCELADA'
  | 'NO_ASISTIO';

export const ESTADOS_VISITA: EstadoVisita[] = [
  'PROGRAMADA',
  'CONFIRMADA',
  'REPROGRAMADA',
  'REALIZADA',
  'CANCELADA',
  'NO_ASISTIO',
];

export const VISITA_BADGE: Record<EstadoVisita, string> = {
  PROGRAMADA: 'badge-soft-primary',
  CONFIRMADA: 'badge-soft-info',
  REPROGRAMADA: 'badge-soft-warning',
  REALIZADA: 'badge-soft-success',
  CANCELADA: 'badge-soft-secondary',
  NO_ASISTIO: 'badge-soft-danger',
};

export type EstadoReserva = 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'CONVERTIDA';

export const ESTADOS_RESERVA: EstadoReserva[] = ['ACTIVA', 'VENCIDA', 'CANCELADA', 'CONVERTIDA'];

export const RESERVA_BADGE: Record<EstadoReserva, string> = {
  ACTIVA: 'badge-soft-success',
  VENCIDA: 'badge-soft-danger',
  CANCELADA: 'badge-soft-secondary',
  CONVERTIDA: 'badge-soft-info',
};

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

export interface Visita {
  id: string;
  fechaHora: string;
  duracionEstimada: number | null;
  lugarEncuentro: string | null;
  estado: EstadoVisita;
  resultado: string | null;
  observaciones: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  empresaId: string;
  clienteId: string;
  asesorId: string;
  propiedadId: string;
  pipelineId: string | null;
  seguimientoId: string | null;
  reprogramadaDeId: string | null;
  cliente: ClienteLight;
  asesor: AsesorLight;
  propiedad: PropiedadLight;
}

export interface Reserva {
  id: string;
  estado: EstadoReserva;
  montoSeparacion: string;
  fechaReserva: string;
  fechaVencimiento: string;
  observaciones: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  empresaId: string;
  clienteId: string;
  propiedadId: string;
  asesorId: string;
  pipelineId: string | null;
  visitaId: string | null;
  cliente: ClienteLight;
  propiedad: PropiedadLight;
  asesor: AsesorLight;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateVisitaInput {
  fechaHora: string;
  duracionEstimada?: number | null;
  lugarEncuentro?: string | null;
  estado?: EstadoVisita;
  resultado?: string | null;
  observaciones?: string | null;
  clienteId: string;
  asesorId: string;
  propiedadId: string;
  pipelineId?: string | null;
  seguimientoId?: string | null;
  reprogramadaDeId?: string | null;
}

export type UpdateVisitaInput = Partial<CreateVisitaInput>;

export interface FindVisitasQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoVisita | '';
  clienteId?: string;
  propiedadId?: string;
  asesorId?: string;
  pipelineId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fechaHora' | 'estado';
  sortDirection?: 'asc' | 'desc';
}

export interface CreateReservaInput {
  clienteId: string;
  propiedadId: string;
  asesorId: string;
  pipelineId?: string | null;
  visitaId?: string | null;
  montoSeparacion: number;
  fechaReserva?: string | null;
  fechaVencimiento: string;
  estado?: EstadoReserva;
  observaciones?: string | null;
}

export type UpdateReservaInput = Partial<CreateReservaInput>;

export interface FindReservasQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoReserva | '';
  clienteId?: string;
  propiedadId?: string;
  asesorId?: string;
  pipelineId?: string;
  visitaId?: string;
  vencidas?: boolean | '';
  sortBy?: 'createdAt' | 'updatedAt' | 'fechaReserva' | 'fechaVencimiento' | 'montoSeparacion' | 'estado';
  sortDirection?: 'asc' | 'desc';
}
