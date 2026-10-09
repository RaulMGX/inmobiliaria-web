import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../types/auth.types';

@Injectable()
export class EmpresaMatchGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) return true;

    const rutaEmpresaId = request.params?.empresaId as string | undefined;
    if (!rutaEmpresaId) return true;

    if (user.empresaId !== rutaEmpresaId) {
      throw new ForbiddenException('Empresa de la ruta no coincide con la del usuario autenticado.');
    }
    return true;
  }
}
