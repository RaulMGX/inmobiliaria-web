import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreatePropiedadDto } from './dto/create-propiedad.dto';
import { FindPropiedadesQueryDto } from './dto/find-propiedades.query.dto';
import { UpdatePropiedadDto } from './dto/update-propiedad.dto';

@Injectable()
export class PropiedadesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreatePropiedadDto) {
    this.validateBusinessRules(dto);
    await this.ensureProyectoDisponible(empresaId, dto.proyectoId);
    await this.ensureCodigoDisponible(dto.codigoInterno);

    try {
      return await this.prisma.propiedad.create({
        data: this.buildCreateData(dto),
        include: this.defaultInclude(),
      });
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async findAll(empresaId: string, query: FindPropiedadesQueryDto) {
    this.validateFindRules(query);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.propiedad.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.propiedad.count({ where }),
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
    const propiedad = await this.prisma.propiedad.findFirst({
      where: this.baseWhereByEmpresa(empresaId, { id }),
      include: this.defaultInclude(),
    });

    if (!propiedad) {
      throw new NotFoundException(
        'Propiedad no encontrada para la empresa indicada.',
      );
    }

    return propiedad;
  }

  async update(empresaId: string, id: string, dto: UpdatePropiedadDto) {
    this.validateBusinessRules(dto);
    this.validateUpdateRules(dto);

    await this.findOne(empresaId, id);

    if (dto.proyectoId) {
      await this.ensureProyectoDisponible(empresaId, dto.proyectoId);
    }

    if (dto.codigoInterno) {
      await this.ensureCodigoDisponible(dto.codigoInterno, id);
    }

    try {
      return await this.prisma.propiedad.update({
        where: { id },
        data: this.buildUpdateData(dto),
        include: this.defaultInclude(),
      });
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.propiedad.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private baseWhereByEmpresa(
    empresaId: string,
    extra?: Prisma.PropiedadWhereInput,
  ): Prisma.PropiedadWhereInput {
    return {
      active: true,
      deletedAt: null,
      proyecto: {
        empresaId,
        active: true,
        deletedAt: null,
      },
      ...(extra ?? {}),
    };
  }

  private buildFindWhere(
    empresaId: string,
    query: FindPropiedadesQueryDto,
  ): Prisma.PropiedadWhereInput {
    const search = query.search?.trim();
    const containsInsensitiveProp = (
      value: string,
    ): Prisma.StringFilter<'Propiedad'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsInsensitiveProj = (
      value: string,
    ): Prisma.StringFilter<'Proyecto'> => ({
      contains: value,
      mode: 'insensitive',
    });

    const estadoFromDisponible =
      query.disponible === undefined
        ? undefined
        : query.disponible
          ? 'DISPONIBLE'
          : { not: 'DISPONIBLE' };

    return {
      ...this.baseWhereByEmpresa(empresaId),
      ...(query.proyectoId ? { proyectoId: query.proyectoId } : {}),
      ...(query.tipoPropiedad ? { tipoPropiedad: query.tipoPropiedad as any } : {}),
      ...(query.estado
        ? { estado: query.estado as any }
        : estadoFromDisponible
          ? { estado: estadoFromDisponible as any }
          : {}),
      ...(search
        ? {
            OR: <Prisma.PropiedadWhereInput[]>[
              { codigoInterno: containsInsensitiveProp(search) },
              { nombre: containsInsensitiveProp(search) },
              { direccion: containsInsensitiveProp(search) },
              { distrito: containsInsensitiveProp(search) },
              { proyecto: { nombre: containsInsensitiveProj(search) } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindPropiedadesQueryDto,
  ): Prisma.PropiedadOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';
    return { [sortBy]: direction };
  }

  private buildCreateData(dto: CreatePropiedadDto): Prisma.PropiedadCreateInput {
    const normalized = this.normalizePropiedadPayload(dto);
    const { proyectoId } = dto;

    return {
      ...normalized,
      proyectoId,
    } as unknown as Prisma.PropiedadCreateInput;
  }

  private buildUpdateData(dto: UpdatePropiedadDto): Prisma.PropiedadUpdateInput {
    const normalized = this.normalizePropiedadPayload(dto);

    return {
      ...normalized,
      ...(dto.proyectoId ? { proyectoId: dto.proyectoId } : {}),
    } as unknown as Prisma.PropiedadUpdateInput;
  }

  private normalizePropiedadPayload(dto: Partial<CreatePropiedadDto>) {
    return {
      ...(dto.codigoInterno !== undefined
        ? { codigoInterno: dto.codigoInterno.trim() }
        : {}),
      ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
      ...(dto.tipoPropiedad !== undefined ? { tipoPropiedad: dto.tipoPropiedad as any } : {}),
      ...(dto.estado !== undefined ? { estado: dto.estado as any } : {}),
      ...(dto.precio !== undefined ? { precio: dto.precio } : {}),
      ...(dto.areaTotal !== undefined ? { areaTotal: dto.areaTotal ?? null } : {}),
      ...(dto.areaConstruida !== undefined
        ? { areaConstruida: dto.areaConstruida ?? null }
        : {}),
      ...(dto.habitaciones !== undefined ? { habitaciones: dto.habitaciones ?? null } : {}),
      ...(dto.banos !== undefined ? { banos: dto.banos ?? null } : {}),
      ...(dto.estacionamientos !== undefined
        ? { estacionamientos: dto.estacionamientos ?? null }
        : {}),
      ...(dto.piso !== undefined ? { piso: dto.piso ?? null } : {}),
      ...(dto.direccion !== undefined ? { direccion: dto.direccion?.trim() || null } : {}),
      ...(dto.distrito !== undefined ? { distrito: dto.distrito?.trim() || null } : {}),
      ...(dto.ciudad !== undefined ? { ciudad: dto.ciudad?.trim() || null } : {}),
      ...(dto.latitud !== undefined ? { latitud: dto.latitud ?? null } : {}),
      ...(dto.longitud !== undefined ? { longitud: dto.longitud ?? null } : {}),
      ...(dto.descripcion !== undefined
        ? { descripcion: dto.descripcion?.trim() || null }
        : {}),
    };
  }

  private validateBusinessRules(dto: Partial<CreatePropiedadDto>) {
    if (
      dto.areaTotal !== undefined &&
      dto.areaConstruida !== undefined &&
      dto.areaTotal !== null &&
      dto.areaConstruida !== null &&
      dto.areaConstruida > dto.areaTotal
    ) {
      throw new BadRequestException(
        'areaConstruida no puede ser mayor que areaTotal.',
      );
    }
  }

  private validateUpdateRules(dto: UpdatePropiedadDto) {
    if (dto.codigoInterno !== undefined && dto.codigoInterno.trim() === '') {
      throw new BadRequestException('codigoInterno no puede ser vacío.');
    }
  }

  private validateFindRules(query: FindPropiedadesQueryDto) {
    if (query.estado && query.disponible !== undefined) {
      throw new BadRequestException(
        'No se puede enviar estado y disponible al mismo tiempo.',
      );
    }
  }

  private async ensureProyectoDisponible(empresaId: string, proyectoId: string) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: {
        id: proyectoId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!proyecto) {
      throw new NotFoundException(
        'Proyecto no encontrado para la empresa indicada.',
      );
    }
  }

  private async ensureCodigoDisponible(codigoInterno: string, excludeId?: string) {
    const existing = await this.prisma.propiedad.findFirst({
      where: {
        codigoInterno,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, active: true, deletedAt: true },
    });

    if (existing?.active && !existing.deletedAt) {
      throw new ConflictException(
        'Ya existe una propiedad activa con ese código interno.',
      );
    }

    if (existing?.deletedAt) {
      throw new ConflictException(
        'Ya existe una propiedad eliminada con ese código interno; la restricción actual no permite reutilizarlo.',
      );
    }
  }

  private defaultInclude(): Prisma.PropiedadInclude {
    return {
      proyecto: {
        select: {
          id: true,
          nombre: true,
        },
      },
    };
  }

  private handlePrismaError(error: any): never {
    if (error?.code === 'P2002') {
      throw new ConflictException(
        'No se pudo completar la operación por una restricción de unicidad.',
      );
    }

    throw error;
  }
}

