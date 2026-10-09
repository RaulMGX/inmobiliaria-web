import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { hashPassword } from '../auth/utils/password.util';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FindUsuariosQueryDto } from './dto/find-usuarios.query.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import type { AppRol } from '../auth/types/auth.types';

const USUARIO_SELECT: Prisma.UsuarioSelect = {
  id: true,
  empresaId: true,
  nombres: true,
  apellidos: true,
  correo: true,
  telefono: true,
  avatar: true,
  active: true,
  deletedAt: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  rolId: true,
  rol: {
    select: {
      id: true,
      nombre: true,
      descripcion: true,
    },
  },
};

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureRolValido(nombre: string): AppRol {
    if (nombre !== 'ADMIN' && nombre !== 'ASESOR') {
      throw new BadRequestException(`Rol inválido: ${nombre}. Solo se permite ADMIN o ASESOR.`);
    }
    return nombre;
  }

  private async obtenerRolEmpresa(empresaId: string, rolNombre: AppRol) {
    const rol = await this.prisma.rol.findFirst({
      where: {
        empresaId,
        nombre: rolNombre,
        active: true,
        deletedAt: null,
      },
      select: { id: true, nombre: true },
    });
    if (!rol) {
      throw new BadRequestException(
        `El rol ${rolNombre} no está configurado en la empresa. Verifique que los roles ADMIN y ASESOR existan.`,
      );
    }
    return rol;
  }

  private async ensureCorreoDisponible(
    empresaId: string,
    correo: string,
    excludeId?: string,
  ) {
    const normalized = correo.trim().toLowerCase();
    const existing = await this.prisma.usuario.findFirst({
      where: {
        empresaId,
        correo: normalized,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, active: true, deletedAt: true },
    });
    if (!existing) return;
    if (existing.active && !existing.deletedAt) {
      throw new ConflictException(
        'Ya existe un usuario activo con ese correo electrónico en la empresa.',
      );
    }
    throw new ConflictException(
      'Ya existe un usuario con ese correo en la empresa (eliminado o inactivo).',
    );
  }

  async create(empresaId: string, dto: CreateUsuarioDto) {
    const rolNombre = this.ensureRolValido(dto.rolNombre);
    const rol = await this.obtenerRolEmpresa(empresaId, rolNombre);
    await this.ensureCorreoDisponible(empresaId, dto.correo);

    const passwordHash = await hashPassword(dto.password.trim());

    return this.prisma.usuario.create({
      select: USUARIO_SELECT,
      data: {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        correo: dto.correo.trim().toLowerCase(),
        password: passwordHash,
        telefono: dto.telefono?.trim() || null,
        active: dto.active !== false,
        empresa: { connect: { id: empresaId } },
        rol: { connect: { id: rol.id } },
      },
    });
  }

  async findAll(empresaId: string, query: FindUsuariosQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        select: USUARIO_SELECT,
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.usuario.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(empresaId: string, id: string) {
    const row = await this.prisma.usuario.findFirst({
      select: USUARIO_SELECT,
      where: {
        id,
        empresaId,
        deletedAt: null,
      },
    });
    if (!row) {
      throw new NotFoundException('Usuario no encontrado en la empresa indicada.');
    }
    return row;
  }

  async update(empresaId: string, id: string, dto: UpdateUsuarioDto) {
    await this.findOne(empresaId, id);

    if (dto.correo) await this.ensureCorreoDisponible(empresaId, dto.correo, id);

    let rolId: string | undefined;
    if (dto.rolNombre) {
      const rolNombre = this.ensureRolValido(dto.rolNombre);
      const rol = await this.obtenerRolEmpresa(empresaId, rolNombre);
      rolId = rol.id;
    }

    const data: Prisma.UsuarioUpdateInput = {
      ...(dto.nombres !== undefined ? { nombres: dto.nombres.trim() } : {}),
      ...(dto.apellidos !== undefined ? { apellidos: dto.apellidos.trim() } : {}),
      ...(dto.correo !== undefined ? { correo: dto.correo.trim().toLowerCase() } : {}),
      ...(dto.telefono !== undefined
        ? { telefono: dto.telefono?.trim() || null }
        : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(rolId ? { rol: { connect: { id: rolId } } } : {}),
    };

    return this.prisma.usuario.update({
      select: USUARIO_SELECT,
      where: { id },
      data,
    });
  }

  async toggleActive(empresaId: string, id: string) {
    const usuario = await this.findOne(empresaId, id);
    return this.prisma.usuario.update({
      select: USUARIO_SELECT,
      where: { id },
      data: { active: !usuario.active },
    });
  }

  async changePassword(empresaId: string, id: string, dto: ChangePasswordDto) {
    await this.findOne(empresaId, id);
    const passwordHash = await hashPassword(dto.password.trim());
    return this.prisma.usuario.update({
      select: USUARIO_SELECT,
      where: { id },
      data: { password: passwordHash },
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);
    return this.prisma.usuario.update({
      select: USUARIO_SELECT,
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private buildWhere(
    empresaId: string,
    query: FindUsuariosQueryDto,
  ): Prisma.UsuarioWhereInput {
    const search = query.search?.trim();
    const terms = search?.split(/\s+/).filter(Boolean) ?? [];
    const insensitive = (value: string): Prisma.StringFilter<'Usuario'> => ({
      contains: value,
      mode: 'insensitive',
    });

    const searchConditions: Prisma.UsuarioWhereInput[] =
      terms.length > 0
        ? [
            {
              AND: terms.map((term) => ({
                OR: [
                  { nombres: insensitive(term) },
                  { apellidos: insensitive(term) },
                  { correo: insensitive(term) },
                  { telefono: insensitive(term) },
                ],
              })),
            },
          ]
        : [];

    return {
      empresaId,
      deletedAt: null,
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.rolNombre ? { rol: { nombre: query.rolNombre } } : {}),
      ...(search ? { OR: <Prisma.UsuarioWhereInput[]>searchConditions } : {}),
    };
  }

  private buildOrderBy(
    query: FindUsuariosQueryDto,
  ): Prisma.UsuarioOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';
    if (sortBy === 'lastLogin') return { lastLogin: direction };
    if (sortBy === 'correo') return { correo: direction };
    if (sortBy === 'nombres') return { nombres: direction };
    if (sortBy === 'apellidos') return { apellidos: direction };
    if (sortBy === 'updatedAt') return { updatedAt: direction };
    return { createdAt: direction };
  }
}
