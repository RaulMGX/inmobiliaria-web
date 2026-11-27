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

export type OrigenLead =
  | 'WHATSAPP'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'PAGINA_WEB'
  | 'REFERIDO'
  | 'CAMINATA'
  | 'LLAMADA'
  | 'OTRO';

export type TipoPropiedad =
  | 'CASA'
  | 'DEPARTAMENTO'
  | 'TERRENO'
  | 'LOCAL'
  | 'OFICINA'
  | 'OTRO';

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

export interface PropiedadLight {
  id: string;
  codigoInterno: string;
  nombre: string;
  tipoPropiedad: TipoPropiedad;
  estado: string;
  precio: string | number;
  distrito: string | null;
  ciudad: string | null;
  habitaciones: number | null;
  banos: number | null;
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
  montoEstimado: number | null;
  origen: OrigenLead | null;
  presupuestoMaximo: number | null;
  zonaInteres: string | null;
  tipoPropiedadInteres: TipoPropiedad | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  empresaId: string;
  clienteId: string;
  asesorId: string;
  propiedadId: string | null;
  cliente: ClienteLight;
  asesor: AsesorLight;
  propiedad: PropiedadLight | null;
}

export interface CreatePipelineInput {
  clienteId: string;
  asesorId: string;
  propiedadId?: string | null;
  etapa?: EtapaPipeline;
  fechaIngreso?: string;
  fechaUltimoSeguimiento?: string | null;
  proximaFechaSeguimiento?: string | null;
  prioridad?: PrioridadPipeline;
  probabilidadCierre?: number;
  montoEstimado?: number | null;
  origen?: OrigenLead | null;
  presupuestoMaximo?: number | null;
  zonaInteres?: string | null;
  tipoPropiedadInteres?: TipoPropiedad | null;
  motivoPerdida?: string | null;
  observaciones?: string | null;
}

export type UpdatePipelineInput = Partial<CreatePipelineInput>;

export interface FindPipelineQuery {
  page?: number;
  limit?: number;
  search?: string;
  etapa?: string;
  prioridad?: string;
  origen?: string;
  clienteId?: string;
  asesorId?: string;
  propiedadId?: string;
  vencidas?: string | boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

export const ETAPA_LABEL: Record<EtapaPipeline, string> = {
  NUEVO: 'Nuevo lead',
  CONTACTADO: 'Contactado',
  INTERESADO: 'Calificado',
  VISITA_PROGRAMADA: 'Visita programada',
  NEGOCIACION: 'Oferta / Negociación',
  SEPARACION: 'Separación',
  VENTA_GANADA: 'Venta ganada',
  VENTA_PERDIDA: 'Venta perdida',
};

export const ETAPA_COLOR: Record<EtapaPipeline, string> = {
  NUEVO: '#6c757d',
  CONTACTADO: '#0dcaf0',
  INTERESADO: '#0d6efd',
  VISITA_PROGRAMADA: '#6610f2',
  NEGOCIACION: '#fd7e14',
  SEPARACION: '#ffc107',
  VENTA_GANADA: '#198754',
  VENTA_PERDIDA: '#dc3545',
};

export const ETAPA_BADGE: Record<EtapaPipeline, string> = {
  NUEVO: 'bg-secondary',
  CONTACTADO: 'bg-info text-dark',
  INTERESADO: 'bg-primary',
  VISITA_PROGRAMADA: 'bg-purple text-white',
  NEGOCIACION: 'bg-warning text-dark',
  SEPARACION: 'bg-warning text-dark',
  VENTA_GANADA: 'bg-success',
  VENTA_PERDIDA: 'bg-danger',
};

export const PRIORIDADES_PIPELINE: PrioridadPipeline[] = ['BAJA', 'MEDIA', 'ALTA'];

export const PRIORIDAD_LABEL: Record<PrioridadPipeline, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
};

export const PRIORIDAD_COLOR: Record<PrioridadPipeline, string> = {
  BAJA: '#6c757d',
  MEDIA: '#ffc107',
  ALTA: '#dc3545',
};

export const ORIGEN_LEAD: { key: OrigenLead; label: string; icon: string; color: string }[] = [
  { key: 'WHATSAPP', label: 'WhatsApp', icon: 'bi-whatsapp', color: '#25D366' },
  { key: 'FACEBOOK', label: 'Facebook', icon: 'bi-facebook', color: '#1877F2' },
  { key: 'INSTAGRAM', label: 'Instagram', icon: 'bi-instagram', color: '#E4405F' },
  { key: 'PAGINA_WEB', label: 'Página web', icon: 'bi-globe', color: '#0dcaf0' },
  { key: 'REFERIDO', label: 'Referido', icon: 'bi-people', color: '#6610f2' },
  { key: 'CAMINATA', label: 'Caminata', icon: 'bi-person-walking', color: '#fd7e14' },
  { key: 'LLAMADA', label: 'Llamada', icon: 'bi-telephone', color: '#198754' },
  { key: 'OTRO', label: 'Otro', icon: 'bi-three-dots', color: '#6c757d' },
];

export const TIPO_PROPIEDAD: { key: TipoPropiedad; label: string }[] = [
  { key: 'CASA', label: 'Casa' },
  { key: 'DEPARTAMENTO', label: 'Departamento' },
  { key: 'TERRENO', label: 'Terreno' },
  { key: 'LOCAL', label: 'Local' },
  { key: 'OFICINA', label: 'Oficina' },
  { key: 'OTRO', label: 'Otro' },
];

export function origenMeta(key: OrigenLead | null) {
  if (!key) return null;
  return ORIGEN_LEAD.find((o) => o.key === key) ?? null;
}
