import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateComisionDto } from './dto/create-comision.dto';
import { FindComisionesQueryDto } from './dto/find-comisiones.query.dto';
import { UpdateComisionDto } from './dto/update-comision.dto';

@Injectable()
export class ComisionesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateComisionDto) {
    this.validateAmounts(dto);

    await Promise.all([
      this.ensureVentaDisponible(empresaId, dto.ventaId),
      this.ensureAsesorDisponible(empresaId, dto.asesorId),
      this.ensureNoDuplicateComision(dto.ventaId, dto.asesorId),
    ]);

    try {
      return await this.prisma.comision.create({
        data: this.buildCreateData(empresaId, dto),
        include: this.defaultInclude(),
      });
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async findAll(empresaId: string, query: FindComisionesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.comision.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.comision.count({ where }),
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
    const comision = await this.prisma.comision.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!comision) {
      throw new NotFoundException('Comisión no encontrada para la empresa indicada.');
    }

    return comision;
  }

  async update(empresaId: string, id: string, dto: UpdateComisionDto) {
    const current = await this.findOne(empresaId, id);

    if (dto.ventaId !== undefined && dto.ventaId !== current.ventaId) {
      throw new BadRequestException('No se permite cambiar la venta asociada a una comisión existente.');
    }

    if (dto.asesorId !== undefined && dto.asesorId !== current.asesorId) {
      throw new BadRequestException('No se permite cambiar el asesor asociado a una comisión existente.');
    }

    this.validateAmounts({
      porcentajeComision: dto.porcentajeComision ?? Number(current.porcentajeComision),
      montoComision: dto.montoComision ?? Number(current.montoComision),
    });

    return this.prisma.comision.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: this.defaultInclude(),
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.comision.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindComisionesQueryDto,
  ): Prisma.ComisionWhereInput {
    const search = query.search?.trim();
    const containsAsesor = (value: string): Prisma.StringFilter<'Usuario'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsCliente = (value: string): Prisma.StringFilter<'Cliente'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsPropiedad = (value: string): Prisma.StringFilter<'Propiedad'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsComision = (value: string): Prisma.StringFilter<'Comision'> => ({
      contains: value,
      mode: 'insensitive',
    });

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado as any } : {}),
      ...(query.ventaId ? { ventaId: query.ventaId } : {}),
      ...(query.asesorId ? { asesorId: query.asesorId } : {}),
      ...(search
        ? {
            OR: <Prisma.ComisionWhereInput[]>[
              { asesor: { nombres: containsAsesor(search) } },
              { asesor: { apellidos: containsAsesor(search) } },
              { asesor: { correo: containsAsesor(search) } },
              {
                venta: {
                  cliente: { nombres: containsCliente(search) },
                },
              },
              {
                venta: {
                  cliente: { apellidos: containsCliente(search) },
                },
              },
              {
                venta: {
                  cliente: { numeroDocumento: containsCliente(search) },
                },
              },
              {
                venta: {
                  propiedad: { nombre: containsPropiedad(search) },
                },
              },
              {
                venta: {
                  propiedad: { codigoInterno: containsPropiedad(search) },
                },
              },
              { observaciones: containsComision(search) },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindComisionesQueryDto,
  ): Prisma.ComisionOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'fechaGeneracion';
    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreateComisionDto,
  ): Prisma.ComisionCreateInput {
    return {
      ...this.normalizePayload(dto),
      empresa: { connect: { id: empresaId } },
      venta: { connect: { id: dto.ventaId } },
      asesor: { connect: { id: dto.asesorId } },
    } as Prisma.ComisionCreateInput;
  }

  private buildUpdateData(dto: UpdateComisionDto): Prisma.ComisionUpdateInput {
    return {
      ...this.normalizePayload(dto),
    } as Prisma.ComisionUpdateInput;
  }

  private normalizePayload(dto: Partial<CreateComisionDto>) {
    return {
      ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
      ...(dto.porcentajeComision !== undefined
        ? { porcentajeComision: dto.porcentajeComision }
        : {}),
      ...(dto.montoComision !== undefined ? { montoComision: dto.montoComision } : {}),
      ...(dto.fechaGeneracion !== undefined
        ? { fechaGeneracion: dto.fechaGeneracion ? new Date(dto.fechaGeneracion) : undefined }
        : {}),
      ...(dto.fechaPago !== undefined
        ? { fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : null }
        : {}),
      ...(dto.observaciones !== undefined
        ? { observaciones: dto.observaciones?.trim() || null }
        : {}),
    };
  }

  private validateAmounts(input: {
    porcentajeComision: number;
    montoComision: number;
  }) {
    if (input.porcentajeComision < 0 || input.porcentajeComision > 100) {
      throw new BadRequestException('porcentajeComision debe estar entre 0 y 100.');
    }

    if (input.montoComision < 0) {
      throw new BadRequestException('montoComision no puede ser negativo.');
    }
  }

  private async ensureVentaDisponible(empresaId: string, ventaId: string) {
    const venta = await this.prisma.venta.findFirst({
      where: { id: ventaId, empresaId, active: true, deletedAt: null },
      select: { id: true, totalVenta: true },
    });

    if (!venta) {
      throw new NotFoundException('Venta no encontrada para la empresa indicada.');
    }

    return venta;
  }

  private async ensureAsesorDisponible(empresaId: string, asesorId: string) {
    const asesor = await this.prisma.usuario.findFirst({
      where: { id: asesorId, empresaId, active: true, deletedAt: null },
      select: { id: true },
    });

    if (!asesor) {
      throw new NotFoundException('Asesor no encontrado para la empresa indicada.');
    }
  }

  private async ensureNoDuplicateComision(ventaId: string, asesorId: string) {
    const existing = await this.prisma.comision.findFirst({
      where: {
        ventaId,
        asesorId,
      },
      select: { id: true, active: true, deletedAt: true },
    });

    if (existing?.active && !existing.deletedAt) {
      throw new ConflictException(
        'Ya existe una comisión registrada para esta venta y asesor.',
      );
    }
  }

  private defaultInclude(): Prisma.ComisionInclude {
    return {
      asesor: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
        },
      },
      venta: {
        select: {
          id: true,
          estado: true,
          fechaVenta: true,
          totalVenta: true,
          precioFinal: true,
          cliente: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              correo: true,
              numeroDocumento: true,
              celular: true,
            },
          },
          propiedad: {
            select: {
              id: true,
              codigoInterno: true,
              nombre: true,
              estado: true,
              proyecto: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private handlePrismaError(error: any): never {
    if (error?.code === 'P2002') {
      throw new ConflictException(
        'No se pudo completar la operación por una restricción de unicidad (ventaId + asesorId).',
      );
    }

    throw error;
  }
}
