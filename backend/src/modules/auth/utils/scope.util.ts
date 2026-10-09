import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../types/auth.types';

/**
 * Valida que el JWT pertenezca a la empresa de la ruta.
 * Si el usuario es ASESOR, fuerza el scope `asesorId = user.sub` en el where.
 */
export function scopeWhereForUser<T extends Record<string, any>>(
  user: JwtPayload,
  rutaEmpresaId: string,
  base: T,
  asesorField: keyof T & string = 'asesorId',
): T {
  if (user.empresaId !== rutaEmpresaId) {
    throw new ForbiddenException('Empresa de la ruta no coincide con la del usuario.');
  }
  if (user.rolNombre === 'ASESOR') {
    return { ...base, [asesorField]: user.sub } as T;
  }
  return base;
}

export function ensureEmpresaMatch(user: JwtPayload, rutaEmpresaId: string): void {
  if (user.empresaId !== rutaEmpresaId) {
    throw new ForbiddenException('Empresa de la ruta no coincide con la del usuario.');
  }
}

export function asesorOwnershipCreateOrFail(
  user: JwtPayload,
  rutaEmpresaId: string,
  dto: { asesorId?: string | null } | null | undefined,
): void {
  ensureEmpresaMatch(user, rutaEmpresaId);
  if (user.rolNombre === 'ASESOR') {
    if (dto?.asesorId && dto.asesorId !== user.sub) {
      throw new ForbiddenException('Un asesor solo puede crear registros propios.');
    }
  }
}

export function asesorOwnershipUpdateOrFail(
  user: JwtPayload,
  rutaEmpresaId: string,
  existingAsesorId: string | null | undefined,
): void {
  ensureEmpresaMatch(user, rutaEmpresaId);
  if (user.rolNombre === 'ASESOR' && existingAsesorId !== user.sub) {
    throw new ForbiddenException('No tienes permiso para modificar este registro (no te pertenece).');
  }
}
