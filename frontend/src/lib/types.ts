export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: {
    id: string;
    empresaId: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    avatar: string | null;
    rolId: string;
    rolNombre: 'ADMIN' | 'ASESOR';
    createdAt: string;
  };
}

export interface KpisOverview {
  periodo: { from: string; to: string };
  clientes: { total: number; nuevos: number; pendientes: number };
  propiedades: { total: number; porEstado: Record<string, number> };
  pipeline: { porEtapa: Record<string, number> };
  visitas: { programadas: number; porEstado: Record<string, number> };
  reservas: { activas: number; porEstado: Record<string, number> };
  ventas: {
    delMes: number;
    pagadas: number;
    totalVendido: string;
    porEstado: Record<string, number>;
  };
  topAsesores: Array<{
    asesorId: string;
    nombres: string | null;
    apellidos: string | null;
    correo: string | null;
    cantidadVentas: number;
    totalVendido: string;
  }>;
  pagos: {
    cantidadPagados: number;
    montoCobrado: string;
    pendientes: number;
    vencidos: number;
    saldoPendienteTotal: string;
  };
  comisiones: {
    cantidadPendientes: number;
    montoPendiente: string;
    cantidadPagadas: number;
    montoPagado: string;
  };
}

export interface UserSession {
  accessToken: string;
  refreshToken: string;
  usuario: LoginResponse['usuario'];
}
