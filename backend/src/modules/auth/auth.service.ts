import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import type { AppRol, JwtPayload } from './types/auth.types';
import { comparePassword, hashPassword } from './utils/password.util';

const VALID_ROLES: AppRol[] = ['ADMIN', 'ASESOR'];

function normalizarRol(nombre?: string | null): AppRol {
  const n = (nombre ?? '').toUpperCase().trim();
  if ((VALID_ROLES as string[]).includes(n)) return n as AppRol;
  return 'ASESOR';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { correo: dto.correo.toLowerCase().trim(), active: true, deletedAt: null },
      include: { rol: { select: { id: true, nombre: true } } },
    });
    if (!usuario) throw new UnauthorizedException('Credenciales inválidas.');

    const ok = await comparePassword(dto.password, usuario.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas.');

    const rolNombre = normalizarRol(usuario.rol?.nombre);

    const payload: JwtPayload = {
      sub: usuario.id,
      empresaId: usuario.empresaId,
      rolId: usuario.rolId,
      rolNombre,
      correo: usuario.correo,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
    };

    const accessTtl = Number(this.configService.get<number>('JWT_EXPIRES_IN_SECONDS') ?? 3600);
    const refreshTtl = Number(this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS') ?? 7 * 24 * 3600);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      expiresIn: accessTtl,
    });
    const refreshToken = crypto.randomBytes(40).toString('base64url');

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { lastLogin: new Date(), refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtl,
      usuario: {
        id: usuario.id,
        empresaId: usuario.empresaId,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        telefono: usuario.telefono,
        avatar: usuario.avatar,
        rolId: usuario.rolId,
        rolNombre,
        createdAt: usuario.createdAt,
      },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new BadRequestException('refreshToken requerido.');
    const usuario = await this.prisma.usuario.findFirst({
      where: { refreshToken, active: true, deletedAt: null },
      include: { rol: { select: { id: true, nombre: true } } },
    });
    if (!usuario) throw new UnauthorizedException('Refresh token inválido.');

    const rolNombre = normalizarRol(usuario.rol?.nombre);
    const payload: JwtPayload = {
      sub: usuario.id,
      empresaId: usuario.empresaId,
      rolId: usuario.rolId,
      rolNombre,
      correo: usuario.correo,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
    };
    const accessTtl = Number(this.configService.get<number>('JWT_EXPIRES_IN_SECONDS') ?? 3600);
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      expiresIn: accessTtl,
    });
    return { accessToken, tokenType: 'Bearer', expiresIn: accessTtl };
  }

  async me(user: JwtPayload) {
    const usuario = await this.prisma.usuario.findFirstOrThrow({
      where: { id: user.sub, empresaId: user.empresaId, active: true, deletedAt: null },
      select: {
        id: true, nombres: true, apellidos: true, correo: true,
        telefono: true, avatar: true, createdAt: true, updatedAt: true,
        rolId: true, empresaId: true,
        rol: { select: { id: true, nombre: true, descripcion: true } },
      },
    });
    return {
      ...usuario,
      rolNombre: normalizarRol(usuario.rol?.nombre),
    };
  }

  async updateMe(user: JwtPayload, dto: UpdateMeDto) {
    const where = { id: user.sub, empresaId: user.empresaId, deletedAt: null };
    const existe = await this.prisma.usuario.findUnique({
      where: { id: user.sub },
      select: { id: true, empresaId: true, correo: true },
    });
    if (!existe || existe.empresaId !== user.empresaId) throw new NotFoundException('Usuario no encontrado.');
    let correo = existe.correo;
    if (dto.correo !== undefined && dto.correo.trim()) {
      const nuevo = dto.correo.trim().toLowerCase();
      if (nuevo !== existe.correo) {
        const usado = await this.prisma.usuario.findFirst({
          where: { empresaId: user.empresaId, correo: nuevo, deletedAt: null, NOT: { id: user.sub } },
          select: { id: true },
        });
        if (usado) throw new BadRequestException('El correo ya está en uso en la empresa.');
        correo = nuevo;
      }
    }
    const data: any = {};
    if (dto.nombres !== undefined) data.nombres = dto.nombres.trim();
    if (dto.apellidos !== undefined) data.apellidos = dto.apellidos.trim();
    if (dto.correo !== undefined && dto.correo.trim()) data.correo = correo;
    if (dto.telefono !== undefined) data.telefono = dto.telefono ? dto.telefono.trim() : null;
    const actualizado = await this.prisma.usuario.update({
      where,
      data,
      select: {
        id: true, nombres: true, apellidos: true, correo: true, telefono: true, avatar: true,
        createdAt: true, updatedAt: true, rolId: true, empresaId: true,
        rol: { select: { id: true, nombre: true, descripcion: true } },
      },
    });
    return { ...actualizado, rolNombre: normalizarRol(actualizado.rol?.nombre) };
  }

  async changeMyPassword(user: JwtPayload, dto: ChangeMyPasswordDto) {
    if (dto.confirmPassword !== undefined && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('La confirmación de la contraseña no coincide.');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.sub },
      select: { id: true, empresaId: true, password: true },
    });
    if (!usuario || usuario.empresaId !== user.empresaId) throw new NotFoundException('Usuario no encontrado.');
    const ok = await comparePassword(dto.actualPassword, usuario.password);
    if (!ok) throw new BadRequestException('La contraseña actual es incorrecta.');
    const newHash = await hashPassword(dto.password.trim());
    await this.prisma.usuario.update({
      where: { id: user.sub, empresaId: user.empresaId },
      data: { password: newHash },
    });
    return { ok: true, message: 'Contraseña actualizada correctamente.' };
  }

  async logout(user: JwtPayload) {
    await this.prisma.usuario.updateMany({
      where: { id: user.sub, empresaId: user.empresaId },
      data: { refreshToken: null },
    });
    return { ok: true };
  }
}
