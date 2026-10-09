import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { FindPagosQueryDto } from './dto/find-pagos.query.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';

@Injectable()
export class PagosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreatePagoDto) {
    const estado = dto.estado ?? 'PAGADO';

    if (estado !== 'PAGADO') {
      throw new BadRequestException('Solo se permite crear pagos en estado PAGADO.');
    }

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor que cero.');
    }

    const fechaPago = dto.fechaPago ? new Date(dto.fechaPago) : new Date();

    if (Number.isNaN(fechaPago.getTime())) {
      throw new BadRequestException('fechaPago no es una fecha válida.');
    }

    if (dto.fechaVencimiento) {
      const fechaVencimiento = new Date(dto.fechaVencimiento);
      if (Number.isNaN(fechaVencimiento.getTime())) {
        throw new BadRequestException('fechaVencimiento no es una fecha válida.');
      }
    }

    if (dto.registradoPorId) {
      await this.ensureUsuarioDisponible(empresaId, dto.registradoPorId);
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const venta = await this.ensureVentaDisponibleTx(tx, empresaId, dto.ventaId);
        await this.ensureClienteDisponibleTx(tx, empresaId, venta.clienteId);

        const paidSum = await this.getPaidSumTx(tx, dto.ventaId);
        const newPaid = paidSum + dto.monto;

        if (newPaid > Number(venta.totalVenta)) {
          throw new ConflictException(
            'La suma de los pagos no puede superar el total de la venta.',
          );
        }

        const saldoPendiente = Number(venta.totalVenta) - newPaid;

        const pago = await tx.pago.create({
          data: {
            numeroCuota: dto.numeroCuota ?? null,
            fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : null,
            fechaPago,
            monto: dto.monto,
            saldo: saldoPendiente,
            estado: 'PAGADO',
            metodoPago: dto.metodoPago ? (dto.metodoPago as any) : null,
            numeroOperacion: dto.numeroOperacion?.trim() || null,
            observaciones: dto.observaciones?.trim() || null,
            empresa: { connect: { id: empresaId } },
            venta: { connect: { id: dto.ventaId } },
            ...(dto.registradoPorId
              ? { registradoPor: { connect: { id: dto.registradoPorId } } }
              : {}),
          },
          include: this.defaultInclude(),
        });

        await tx.venta.update({
          where: { id: dto.ventaId },
          data: {
            saldoPendiente,
            estado: saldoPendiente === 0 ? 'PAGADA' : venta.estado,
          },
        });

        return pago;
      });
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async findAll(empresaId: string, query: FindPagosQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pago.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.pago.count({ where }),
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
    const pago = await this.prisma.pago.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado para la empresa indicada.');
    }

    return pago;
  }

  async update(empresaId: string, id: string, dto: UpdatePagoDto) {
    const current = await this.findOne(empresaId, id);

    if (dto.ventaId !== undefined && dto.ventaId !== current.ventaId) {
      throw new BadRequestException('No se permite cambiar ventaId en un pago existente.');
    }

    if (dto.monto !== undefined && dto.monto <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor que cero.');
    }

    const newEstado = dto.estado ?? current.estado;
    const newMonto = dto.monto ?? Number(current.monto);

    if (newEstado === 'PAGADO') {
      const fechaPago = dto.fechaPago
        ? new Date(dto.fechaPago)
        : current.fechaPago ?? new Date();
      if (Number.isNaN(fechaPago.getTime())) {
        throw new BadRequestException('fechaPago no es una fecha válida.');
      }
    }

    if (dto.fechaVencimiento) {
      const fechaVencimiento = new Date(dto.fechaVencimiento);
      if (Number.isNaN(fechaVencimiento.getTime())) {
        throw new BadRequestException('fechaVencimiento no es una fecha válida.');
      }
    }

    if (dto.registradoPorId) {
      await this.ensureUsuarioDisponible(empresaId, dto.registradoPorId);
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const venta = await this.ensureVentaDisponibleTx(tx, empresaId, current.ventaId);
        await this.ensureClienteDisponibleTx(tx, empresaId, venta.clienteId);

        const paidSumExcl = await this.getPaidSumTx(tx, current.ventaId, id);
        const newPaid =
          paidSumExcl + (newEstado === 'PAGADO' ? newMonto : 0);

        if (newPaid > Number(venta.totalVenta)) {
          throw new ConflictException(
            'La suma de los pagos no puede superar el total de la venta.',
          );
        }

        const saldoPendiente = Number(venta.totalVenta) - newPaid;

        const updatedPago = await tx.pago.update({
          where: { id },
          data: {
            numeroCuota:
              dto.numeroCuota !== undefined ? dto.numeroCuota ?? null : undefined,
            fechaVencimiento:
              dto.fechaVencimiento !== undefined
                ? dto.fechaVencimiento
                  ? new Date(dto.fechaVencimiento)
                  : null
                : undefined,
            fechaPago:
              dto.fechaPago !== undefined
                ? dto.fechaPago
                  ? new Date(dto.fechaPago)
                  : null
                : newEstado === 'PAGADO' && current.fechaPago === null
                  ? new Date()
                  : undefined,
            monto: dto.monto !== undefined ? dto.monto : undefined,
            saldo: saldoPendiente,
            estado: dto.estado !== undefined ? (dto.estado as any) : undefined,
            metodoPago:
              dto.metodoPago !== undefined ? (dto.metodoPago as any) : undefined,
            numeroOperacion:
              dto.numeroOperacion !== undefined
                ? dto.numeroOperacion?.trim() || null
                : undefined,
            observaciones:
              dto.observaciones !== undefined
                ? dto.observaciones?.trim() || null
                : undefined,
            ...(dto.registradoPorId !== undefined
              ? dto.registradoPorId
                ? { registradoPor: { connect: { id: dto.registradoPorId } } }
                : { registradoPor: { disconnect: true } }
              : {}),
          },
          include: this.defaultInclude(),
        });

        await tx.venta.update({
          where: { id: current.ventaId },
          data: {
            saldoPendiente,
            estado:
              saldoPendiente === 0
                ? 'PAGADA'
                : venta.estado === 'PAGADA'
                  ? 'FORMALIZADA'
                  : venta.estado,
          },
        });

        return updatedPago;
      });
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async remove(empresaId: string, id: string) {
    const current = await this.findOne(empresaId, id);

    return this.prisma.$transaction(async (tx: any) => {
      const venta = await this.ensureVentaDisponibleTx(tx, empresaId, current.ventaId);

      await tx.pago.update({
        where: { id },
        data: {
          active: false,
          deletedAt: new Date(),
        },
      });

      const paidSum = await this.getPaidSumTx(tx, current.ventaId);
      const saldoPendiente = Number(venta.totalVenta) - paidSum;

      await tx.venta.update({
        where: { id: current.ventaId },
        data: {
          saldoPendiente,
          estado:
            saldoPendiente === 0
              ? 'PAGADA'
              : venta.estado === 'PAGADA'
                ? 'FORMALIZADA'
                : venta.estado,
        },
      });
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindPagosQueryDto,
  ): Prisma.PagoWhereInput {
    const search = query.search?.trim();
    const containsPago = (value: string): Prisma.StringFilter<'Pago'> => ({
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

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado as any } : {}),
      ...(query.metodoPago ? { metodoPago: query.metodoPago as any } : {}),
      ...(query.ventaId ? { ventaId: query.ventaId } : {}),
      ...(query.registradoPorId ? { registradoPorId: query.registradoPorId } : {}),
      ...(query.clienteId
        ? {
            venta: {
              clienteId: query.clienteId,
            },
          }
        : {}),
      ...(search
        ? {
            OR: <Prisma.PagoWhereInput[]>[
              { numeroOperacion: containsPago(search) },
              { observaciones: containsPago(search) },
              { venta: { cliente: { nombres: containsCliente(search) } } },
              { venta: { cliente: { apellidos: containsCliente(search) } } },
              { venta: { cliente: { numeroDocumento: containsCliente(search) } } },
              { venta: { propiedad: { codigoInterno: containsPropiedad(search) } } },
              { venta: { propiedad: { nombre: containsPropiedad(search) } } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindPagosQueryDto,
  ): Prisma.PagoOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';
    return { [sortBy]: direction };
  }

  private async ensureVentaDisponibleTx(
    tx: Prisma.TransactionClient,
    empresaId: string,
    ventaId: string,
  ) {
    const venta = await tx.venta.findFirst({
      where: {
        id: ventaId,
        empresaId,
      },
      select: {
        id: true,
        estado: true,
        active: true,
        deletedAt: true,
        totalVenta: true,
        saldoPendiente: true,
        clienteId: true,
      },
    });

    if (!venta) {
      throw new NotFoundException('Venta no encontrada para la empresa indicada.');
    }

    if (!venta.active || venta.deletedAt) {
      throw new ConflictException('No se permiten pagos sobre ventas eliminadas.');
    }

    if (venta.estado === 'ANULADA') {
      throw new ConflictException('No se permiten pagos sobre ventas anuladas.');
    }

    return venta;
  }

  private async ensureClienteDisponibleTx(
    tx: Prisma.TransactionClient,
    empresaId: string,
    clienteId: string,
  ) {
    const cliente = await tx.cliente.findFirst({
      where: {
        id: clienteId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado para la empresa indicada.');
    }
  }

  private async ensureUsuarioDisponible(empresaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado para la empresa indicada.');
    }
  }

  private async getPaidSumTx(
    tx: Prisma.TransactionClient,
    ventaId: string,
    excludeId?: string,
  ) {
    const agg = await tx.pago.aggregate({
      where: {
        ventaId,
        active: true,
        deletedAt: null,
        estado: 'PAGADO',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      _sum: {
        monto: true,
      },
    });

    return Number(agg._sum.monto ?? 0);
  }

  private defaultInclude(): Prisma.PagoInclude {
    return {
      venta: {
        select: {
          id: true,
          estado: true,
          fechaVenta: true,
          totalVenta: true,
          saldoPendiente: true,
          cliente: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              correo: true,
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
          propiedad: {
            select: {
              id: true,
              codigoInterno: true,
              nombre: true,
            },
          },
        },
      },
      registradoPor: {
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
    if (error?.code === 'P2002') {
      throw new ConflictException(
        'No se pudo completar la operación por una restricción de unicidad.',
      );
    }

    throw error;
  }
}
