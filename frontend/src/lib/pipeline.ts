export type EtapaPipeline =
  | 'NUEVO'
  | 'CONTACTADO'
  | 'INTERESADO'
  | 'VISITA_PROGRAMADA'
  | 'NEGOCIACION'
  | 'SEPARACION'
  | 'VENTA_GANADA'
  | 'VENTA_PERDIDA';

export type PrioridadPipeline = 'BAJA' | 'MEDIA' | 'ALTA';

export const ETAPAS_PIPELINE: EtapaPipeline[] = [
  'NUEVO',
  'CONTACTADO',
  'INTERESADO',
  'VISITA_PROGRAMADA',
  'NEGOCIACION',
  'SEPARACION',
  'VENTA_GANADA',
  'VENTA_PERDIDA',
];

export const PRIORIDADES_PIPELINE: PrioridadPipeline[] = ['BAJA', 'MEDIA', 'ALTA'];

export const ETAPA_COLOR: Record<EtapaPipeline, string> = {
  NUEVO: '#6366f1',
  CONTACTADO: '#0ea5e9',
  INTERESADO: '#22c55e',
  VISITA_PROGRAMADA: '#f59e0b',
  NEGOCIACION: '#8b5cf6',
  SEPARACION: '#ec4899',
  VENTA_GANADA: '#16a34a',
  VENTA_PERDIDA: '#ef4444',
};

export const ETAPA_BADGE: Record<EtapaPipeline, string> = {
  NUEVO: 'badge-soft-primary',
  CONTACTADO: 'badge-soft-info',
  INTERESADO: 'badge-soft-success',
  VISITA_PROGRAMADA: 'badge-soft-warning',
  NEGOCIACION: 'badge-soft-secondary',
  SEPARACION: 'badge-soft-info',
  VENTA_GANADA: 'badge-soft-success',
  VENTA_PERDIDA: 'badge-soft-danger',
};

export const PRIORIDAD_COLOR: Record<PrioridadPipeline, string> = {
  BAJA: '#9ca3af',
  MEDIA: '#f59e0b',
  ALTA: '#dc2626',
};

export interface ClienteLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  celular: string | null;
  estado: string;
}

export interface AsesorLight {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
}

export interface PipelineOportunidad {
  id: string;
  etapa: EtapaPipeline;
  fechaIngreso: string;
  fechaUltimoSeguimiento: string | null;
  proximaFechaSeguimiento: string | null;
  prioridad: PrioridadPipeline;
  probabilidadCierre: number;
  motivoPerdida: string | null;
  observaciones: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  empresaId: string;
  clienteId: string;
  asesorId: string;
  cliente: ClienteLight;
  asesor: AsesorLight;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreatePipelineInput {
  clienteId: string;
  asesorId: string;
  etapa?: EtapaPipeline;
  fechaIngreso?: string;
  fechaUltimoSeguimiento?: string | null;
  proximaFechaSeguimiento?: string | null;
  prioridad?: PrioridadPipeline;
  probabilidadCierre?: number;
  motivoPerdida?: string | null;
  observaciones?: string | null;
}

export type UpdatePipelineInput = Partial<CreatePipelineInput>;

export interface FindPipelineQuery {
  page?: number;
  limit?: number;
  search?: string;
  etapa?: EtapaPipeline | '';
  prioridad?: PrioridadPipeline | '';
  clienteId?: string;
  asesorId?: string;
  vencidas?: boolean | '';
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'fechaIngreso'
    | 'proximaFechaSeguimiento'
    | 'probabilidadCierre'
    | 'etapa'
    | 'prioridad';
  sortDirection?: 'asc' | 'desc';
}
