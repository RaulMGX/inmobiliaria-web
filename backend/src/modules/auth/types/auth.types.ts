export type AppRol = 'ADMIN' | 'ASESOR';

export interface JwtPayload {
  sub: string;
  empresaId: string;
  rolId: string;
  rolNombre: AppRol;
  correo: string;
  nombres: string;
  apellidos: string;
}
