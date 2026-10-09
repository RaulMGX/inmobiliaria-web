import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { FindVentasQueryDto } from './dto/find-ventas.query.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateVentaDto) {
    this.validateAmounts(dto);

    const reserva = await this.ensureReservaDisponible(empresaId, dto.reservaId);

    if (reserva.estado !== 'ACTIVA') {
      throw new ConflictException(
        'Solo se puede crear una venta desde una reserva en estado ACTIVA.',
      );
    }

    if (reserva.clienteId !== dto.clienteId) {
      throw new BadRequestException(
        'clienteId no coincide con el cliente de la reserva.',
      );
    }

    if (reserva.propiedadId !== dto.propiedadId) {
      throw new BadRequestException(
        'propiedadId no coincide con la propiedad de la reserva.',
      );
    }

    const montoSeparacion = Number((reserva as any).montoSeparacion ?? 0);
    if (montoSeparacion > dto.totalVenta + 0.01) {
      throw new BadRequestException(
        'La seña (montoSeparacion) no puede ser mayor que el total de la venta.',
      );
    }

    await Promise.all([
      this.ensureClienteDisponible(empresaId, dto.clienteId),
      this.ensureAsesorDisponible(empresaId, dto.asesorId),
      this.ensurePropiedadVendible(empresaId, dto.propiedadId),
      this.ensureNoSaleForReserva(dto.reservaId),
    ]);

    try {
      const baseData = this.buildCreateData(empresaId, dto);
      const data = {
        ...(baseData as any),
        saldoPendiente: Math.max(0, dto.totalVenta - montoSeparacion),
      } as Prisma.VentaCreateInput;
      const [venta] = await this.prisma.$transaction([
        this.prisma.venta.create({ data, include: this.defaultInclude() }),
        this.prisma.reserva.update({
          where: { id: dto.reservaId },
          data: { estado: 'CONVERTIDA' as any },
          select: { id: true, estado: true },
        }),
        this.prisma.propiedad.update({
          where: { id: dto.propiedadId },
          data: { estado: 'VENDIDO' as any },
          select: { id: true, estado: true },
        }),
      ] as any);
      return await this.findOne(empresaId, venta.id);
    } catch (error: any) {
      console.error('[VentasService.create] Prisma/DB error:', {
        code: error?.code,
        message: error?.message,
        meta: error?.meta,
        clientVersion: error?.clientVersion,
        stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
        dto: {
          reservaId: dto.reservaId,
          clienteId: dto.clienteId,
          propiedadId: dto.propiedadId,
          asesorId: dto.asesorId,
          estado: dto.estado,
          metodoPago: dto.metodoPago,
          precioFinal: dto.precioFinal,
          descuento: dto.descuento,
          impuestos: dto.impuestos,
          totalVenta: dto.totalVenta,
          fechaVenta: dto.fechaVenta,
        },
      });
      this.handlePrismaError(error);
    }
  }

  async findAll(empresaId: string, query: FindVentasQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.venta.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.venta.count({ where }),
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
    const venta = await this.prisma.venta.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!venta) {
      throw new NotFoundException('Venta no encontrada para la empresa indicada.');
    }

    return venta;
  }

  async update(empresaId: string, id: string, dto: UpdateVentaDto) {
    const current = await this.findOne(empresaId, id);

    if (
      dto.reservaId !== undefined ||
      dto.clienteId !== undefined ||
      dto.propiedadId !== undefined ||
      dto.asesorId !== undefined
    ) {
      throw new BadRequestException(
        'No se permite cambiar reservaId/clienteId/propiedadId/asesorId en una venta existente.',
      );
    }

    this.validateAmounts({
      precioFinal: dto.precioFinal ?? Number(current.precioFinal),
      descuento: dto.descuento ?? Number(current.descuento),
      impuestos: dto.impuestos ?? (current.impuestos ? Number(current.impuestos) : undefined),
      totalVenta: dto.totalVenta ?? Number(current.totalVenta),
    });

    return this.prisma.venta.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: this.defaultInclude(),
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.venta.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindVentasQueryDto,
  ): Prisma.VentaWhereInput {
    const search = query.search?.trim();
    const containsCliente = (value: string): Prisma.StringFilter<'Cliente'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsUsuario = (value: string): Prisma.StringFilter<'Usuario'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsPropiedad = (value: string): Prisma.StringFilter<'Propiedad'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsVenta = (value: string): Prisma.StringFilter<'Venta'> => ({
      contains: value,
      mode: 'insensitive',
    });

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado as any } : {}),
      ...(query.metodoPago ? { metodoPago: query.metodoPago as any } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.propiedadId ? { propiedadId: query.propiedadId } : {}),
      ...(query.reservaId ? { reservaId: query.reservaId } : {}),
      ...(query.asesorId ? { asesorId: query.asesorId } : {}),
      ...(search
        ? {
            OR: <Prisma.VentaWhereInput[]>[
              { cliente: { nombres: containsCliente(search) } },
              { cliente: { apellidos: containsCliente(search) } },
              { cliente: { numeroDocumento: containsCliente(search) } },
              { cliente: { correo: containsCliente(search) } },
              { propiedad: { nombre: containsPropiedad(search) } },
              { propiedad: { codigoInterno: containsPropiedad(search) } },
              { asesor: { nombres: containsUsuario(search) } },
              { asesor: { apellidos: containsUsuario(search) } },
              { observaciones: containsVenta(search) },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindVentasQueryDto,
  ): Prisma.VentaOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'fechaVenta';
    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreateVentaDto,
  ): Prisma.VentaCreateInput {
    const base = {
      ...this.normalizePayload(dto),
      empresaId,
      reservaId: dto.reservaId,
      clienteId: dto.clienteId,
      propiedadId: dto.propiedadId,
      asesorId: dto.asesorId,
      saldoPendiente: dto.totalVenta,
    } as any;

    return base as unknown as Prisma.VentaCreateInput;
  }

  private buildUpdateData(dto: UpdateVentaDto): Prisma.VentaUpdateInput {
    const data = {
      ...this.normalizePayload(dto),
      ...(dto.clienteId !== undefined ? { clienteId: dto.clienteId } : {}),
      ...(dto.asesorId !== undefined ? { asesorId: dto.asesorId } : {}),
      ...(dto.propiedadId !== undefined ? { propiedadId: dto.propiedadId } : {}),
      ...(dto.reservaId !== undefined ? { reservaId: dto.reservaId } : {}),
    } as any;
    return data as unknown as Prisma.VentaUpdateInput;
  }

  private normalizePayload(dto: Partial<CreateVentaDto>) {
    const out: any = {};
    if (dto.estado !== undefined) out.estado = dto.estado;
    if (dto.metodoPago !== undefined) out.metodoPago = dto.metodoPago;
    if (dto.fechaVenta !== undefined && dto.fechaVenta !== null) out.fechaVenta = new Date(dto.fechaVenta);
    if (dto.precioFinal !== undefined) out.precioFinal = dto.precioFinal;
    if (dto.descuento !== undefined) out.descuento = dto.descuento;
    if (dto.impuestos !== undefined) out.impuestos = dto.impuestos ?? null;
    if (dto.totalVenta !== undefined) out.totalVenta = dto.totalVenta;
    if (dto.observaciones !== undefined) out.observaciones = dto.observaciones?.trim() || null;
    return out;
  }

  private validateAmounts(input: {
    precioFinal: number;
    descuento?: number;
    impuestos?: number;
    totalVenta: number;
  }) {
    const descuento = input.descuento ?? 0;
    const impuestos = input.impuestos ?? 0;

    if (input.precioFinal < 0 || descuento < 0 || impuestos < 0 || input.totalVenta < 0) {
      throw new BadRequestException('Los montos no pueden ser negativos.');
    }

    if (descuento > input.precioFinal) {
      throw new BadRequestException('descuento no puede ser mayor que precioFinal.');
    }

    const minTotal = input.precioFinal - descuento;
    const expected = minTotal + impuestos;

    if (input.totalVenta < minTotal) {
      throw new BadRequestException('totalVenta no puede ser menor que precioFinal - descuento.');
    }

    if (input.totalVenta < expected) {
      throw new BadRequestException('totalVenta no puede ser menor que precioFinal - descuento + impuestos.');
    }
  }

  private async ensureClienteDisponible(empresaId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId },
      select: { id: true, active: true, deletedAt: true },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado para la empresa indicada.');
    }
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

  private async ensurePropiedadVendible(empresaId: string, propiedadId: string) {
    const propiedad = await this.prisma.propiedad.findFirst({
      where: {
        id: propiedadId,
        active: true,
        deletedAt: null,
        proyecto: {
          empresaId,
          active: true,
          deletedAt: null,
        },
      },
      select: { id: true, estado: true },
    });

    if (!propiedad) {
      throw new NotFoundException('Propiedad no encontrada para la empresa indicada.');
    }

    if (propiedad.estado === 'VENDIDO') {
      throw new ConflictException('No se puede vender una propiedad ya vendida.');
    }
  }

  private async ensureReservaDisponible(empresaId: string, reservaId: string) {
    const reserva = await this.prisma.reserva.findFirst({
      where: {
        id: reservaId,
        empresaId,
        active: true,
        deletedAt: null,
      },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada para la empresa indicada.');
    }

    return reserva;
  }

  private async ensureNoSaleForReserva(reservaId: string) {
    const existing = await this.prisma.venta.findFirst({
      where: {
        reservaId,
      },
      select: { id: true, active: true, deletedAt: true },
    });

    if (existing?.active && !existing.deletedAt) {
      throw new ConflictException('La reserva ya tiene una venta registrada.');
    }

    if (existing?.deletedAt) {
      throw new ConflictException(
        'La reserva ya tiene una venta eliminada; la restricción actual no permite reutilizar la reserva.',
      );
    }
  }

  private defaultInclude(): Prisma.VentaInclude {
    return {
      cliente: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
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
      reserva: {
        select: {
          id: true,
          estado: true,
          fechaReserva: true,
          fechaVencimiento: true,
          montoSeparacion: true,
        },
      },
      asesor: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
        },
      },
    };
  }

  private handlePrismaError(error: any): never {
    const code = error?.code || '';
    const msg = error?.message || 'Error interno al persistir datos.';
    const meta = error?.meta ? JSON.stringify(error.meta) : '';

    if (code === 'P2002') {
      throw new ConflictException(
        'No se pudo completar la operación por una restricción de unicidad (registro duplicado).',
      );
    }
    if (code === 'P2025' || code === 'P2015' || error instanceof NotFoundException) {
      throw new NotFoundException(msg || 'Registro no encontrado.');
    }
    if (code === 'P2003') {
      throw new BadRequestException(
        `Violación de llave foránea: ${msg} ${meta}`.trim(),
      );
    }

    const detail = [
      code && `[Prisma ${code}]`,
      msg,
      meta && `Detalle: ${meta}`,
    ].filter(Boolean).join(' ').trim();

    throw new InternalServerErrorException(detail);
  }
}
