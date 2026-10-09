export type TipoPropiedad =
  | 'CASA'
  | 'DEPARTAMENTO'
  | 'TERRENO'
  | 'LOCAL'
  | 'OFICINA'
  | 'OTRO';

export type EstadoPropiedad =
  | 'DISPONIBLE'
  | 'RESERVADO'
  | 'VENDIDO'
  | 'SEPARADO';

export const TIPOS_PROPIEDAD: TipoPropiedad[] = [
  'CASA',
  'DEPARTAMENTO',
  'TERRENO',
  'LOCAL',
  'OFICINA',
  'OTRO',
];

export const ESTADOS_PROPIEDAD: EstadoPropiedad[] = [
  'DISPONIBLE',
  'RESERVADO',
  'SEPARADO',
  'VENDIDO',
];

export interface ProyectoLight {
  id: string;
  nombre: string;
}

export interface Propiedad {
  id: string;
  codigoInterno: string;
  nombre: string;
  tipoPropiedad: TipoPropiedad;
  estado: EstadoPropiedad;
  precio: string;
  areaTotal: string | null;
  areaConstruida: string | null;
  habitaciones: number | null;
  banos: number | null;
  estacionamientos: number | null;
  piso: number | null;
  direccion: string | null;
  distrito: string | null;
  ciudad: string | null;
  latitud: string | null;
  longitud: string | null;
  descripcion: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  proyectoId: string;
  proyecto: ProyectoLight;
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

export interface CreatePropiedadInput {
  codigoInterno: string;
  nombre: string;
  tipoPropiedad: TipoPropiedad;
  estado?: EstadoPropiedad;
  precio: number;
  areaTotal?: number | null;
  areaConstruida?: number | null;
  habitaciones?: number | null;
  banos?: number | null;
  estacionamientos?: number | null;
  piso?: number | null;
  direccion?: string | null;
  distrito?: string | null;
  ciudad?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  descripcion?: string | null;
  proyectoId: string;
}

export type UpdatePropiedadInput = Partial<CreatePropiedadInput>;

export interface FindPropiedadesQuery {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoPropiedad | '';
  tipoPropiedad?: TipoPropiedad | '';
  proyectoId?: string;
  disponible?: boolean | '';
  sortBy?: 'createdAt' | 'updatedAt' | 'codigoInterno' | 'nombre' | 'precio' | 'estado';
  sortDirection?: 'asc' | 'desc';
}

export const ESTADO_BADGE: Record<EstadoPropiedad, string> = {
  DISPONIBLE: 'badge-soft-success',
  RESERVADO: 'badge-soft-warning',
  SEPARADO: 'badge-soft-info',
  VENDIDO: 'badge-soft-secondary',
};

export const TIPO_ICON: Record<TipoPropiedad, string> = {
  CASA: 'bi-house-door',
  DEPARTAMENTO: 'bi-buildings',
  TERRENO: 'bi-tree',
  LOCAL: 'bi-shop',
  OFICINA: 'bi-briefcase',
  OTRO: 'bi-tag',
};
