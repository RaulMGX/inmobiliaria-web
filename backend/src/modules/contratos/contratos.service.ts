import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { FindContratosQueryDto } from './dto/find-contratos.query.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';

@Injectable()
export class ContratosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateContratoDto) {
    const estado = dto.estado ?? 'PENDIENTE_FIRMA';
    const version = dto.version ?? 1;

    this.validateBusinessRules({
      estado,
      montoContrato: dto.montoContrato,
      fechaEmision: dto.fechaEmision,
      fechaFirma: dto.fechaFirma,
      fechaVencimiento: dto.fechaVencimiento,
      isCreate: true,
    });

    const venta = await this.ensureVentaDisponible(empresaId, dto.ventaId);

    if (venta.estado === 'ANULADA') {
      throw new ConflictException(
        'No se puede crear un contrato para una venta anulada.',
      );
    }

    if (venta.clienteId !== dto.clienteId) {
      throw new BadRequestException(
        'clienteId no coincide con el cliente de la venta.',
      );
    }

    if (venta.propiedadId !== dto.propiedadId) {
      throw new BadRequestException(
        'propiedadId no coincide con la propiedad de la venta.',
      );
    }

    await Promise.all([
      this.ensureClienteDisponible(empresaId, dto.clienteId),
      this.ensurePropiedadDisponible(empresaId, dto.propiedadId),
      this.ensureResponsableDisponible(empresaId, dto.responsableId),
      this.ensureNoActiveContractForVenta(dto.ventaId),
      this.ensureUniqueContractVersion(empresaId, dto.numeroContrato, version),
    ]);

    try {
      return await this.prisma.contrato.create({
        data: this.buildCreateData(empresaId, dto),
        include: this.defaultInclude(),
      });
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async findAll(empresaId: string, query: FindContratosQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contrato.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.contrato.count({ where }),
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
    const contrato = await this.prisma.contrato.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!contrato) {
      throw new NotFoundException(
        'Contrato no encontrado para la empresa indicada.',
      );
    }

    return contrato;
  }

  async update(empresaId: string, id: string, dto: UpdateContratoDto) {
    const current = await this.findOne(empresaId, id);

    if (
      dto.ventaId !== undefined ||
      dto.clienteId !== undefined ||
      dto.propiedadId !== undefined
    ) {
      throw new BadRequestException(
        'No se permite cambiar ventaId, clienteId o propiedadId en un contrato existente.',
      );
    }

    const nextState = dto.estado ?? current.estado;
    const nextVersion = dto.version ?? current.version;
    const nextNumeroContrato = dto.numeroContrato ?? current.numeroContrato;

    this.validateBusinessRules({
      estado: nextState,
      montoContrato: dto.montoContrato ?? Number(current.montoContrato),
      fechaEmision: dto.fechaEmision ?? current.fechaEmision.toISOString(),
      fechaFirma: dto.fechaFirma ?? current.fechaFirma?.toISOString(),
      fechaVencimiento:
        dto.fechaVencimiento ?? current.fechaVencimiento?.toISOString(),
      currentEstado: current.estado,
      isCreate: false,
    });

    if (dto.responsableId) {
      await this.ensureResponsableDisponible(empresaId, dto.responsableId);
    }

    await Promise.all([
      this.ensureVentaDisponible(empresaId, current.ventaId),
      this.ensureClienteDisponible(empresaId, current.clienteId),
      this.ensurePropiedadDisponible(empresaId, current.propiedadId),
      this.ensureUniqueContractVersion(
        empresaId,
        nextNumeroContrato,
        nextVersion,
        id,
      ),
    ]);

    try {
      return await this.prisma.contrato.update({
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

    return this.prisma.contrato.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindContratosQueryDto,
  ): Prisma.ContratoWhereInput {
    const search = query.search?.trim();
    const containsContrato = (
      value: string,
    ): Prisma.StringFilter<'Contrato'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsCliente = (
      value: string,
    ): Prisma.StringFilter<'Cliente'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsPropiedad = (
      value: string,
    ): Prisma.StringFilter<'Propiedad'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsUsuario = (
      value: string,
    ): Prisma.StringFilter<'Usuario'> => ({
      contains: value,
      mode: 'insensitive',
    });

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado as any } : {}),
      ...(query.tipo ? { tipo: query.tipo as any } : {}),
      ...(query.ventaId ? { ventaId: query.ventaId } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.propiedadId ? { propiedadId: query.propiedadId } : {}),
      ...(query.responsableId ? { responsableId: query.responsableId } : {}),
      ...(search
        ? {
            OR: <Prisma.ContratoWhereInput[]>[
              { numeroContrato: containsContrato(search) },
              { observaciones: containsContrato(search) },
              { rutaPdfFirmado: containsContrato(search) },
              { cliente: { nombres: containsCliente(search) } },
              { cliente: { apellidos: containsCliente(search) } },
              { cliente: { numeroDocumento: containsCliente(search) } },
              { propiedad: { nombre: containsPropiedad(search) } },
              { propiedad: { codigoInterno: containsPropiedad(search) } },
              { responsable: { nombres: containsUsuario(search) } },
              { responsable: { apellidos: containsUsuario(search) } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindContratosQueryDto,
  ): Prisma.ContratoOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'fechaEmision';
    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreateContratoDto,
  ): Prisma.ContratoCreateInput {
    return {
      ...this.normalizePayload(dto),
      version: dto.version ?? 1,
      empresa: { connect: { id: empresaId } },
      venta: { connect: { id: dto.ventaId } },
      cliente: { connect: { id: dto.clienteId } },
      propiedad: { connect: { id: dto.propiedadId } },
      responsable: { connect: { id: dto.responsableId } },
    } as Prisma.ContratoCreateInput;
  }

  private buildUpdateData(dto: UpdateContratoDto): Prisma.ContratoUpdateInput {
    return {
      ...this.normalizePayload(dto),
      ...(dto.version !== undefined ? { version: dto.version } : {}),
      ...(dto.responsableId !== undefined
        ? {
            responsable: {
              connect: { id: dto.responsableId },
            },
          }
        : {}),
    } as Prisma.ContratoUpdateInput;
  }

  private normalizePayload(dto: Partial<CreateContratoDto>) {
    return {
      ...(dto.numeroContrato !== undefined
        ? { numeroContrato: dto.numeroContrato.trim() }
        : {}),
      ...(dto.fechaEmision !== undefined
        ? { fechaEmision: dto.fechaEmision ? new Date(dto.fechaEmision) : undefined }
        : {}),
      ...(dto.fechaFirma !== undefined
        ? { fechaFirma: dto.fechaFirma ? new Date(dto.fechaFirma) : null }
        : {}),
      ...(dto.fechaVencimiento !== undefined
        ? {
            fechaVencimiento: dto.fechaVencimiento
              ? new Date(dto.fechaVencimiento)
              : null,
          }
        : {}),
      ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
      ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
      ...(dto.montoContrato !== undefined ? { montoContrato: dto.montoContrato } : {}),
      ...(dto.observaciones !== undefined
        ? { observaciones: dto.observaciones?.trim() || null }
        : {}),
      ...(dto.rutaPdfFirmado !== undefined
        ? { rutaPdfFirmado: dto.rutaPdfFirmado?.trim() || null }
        : {}),
      ...(dto.hashDocumento !== undefined
        ? { hashDocumento: dto.hashDocumento?.trim() || null }
        : {}),
    };
  }

  private validateBusinessRules(input: {
    estado: string;
    montoContrato: number;
    fechaEmision?: string;
    fechaFirma?: string;
    fechaVencimiento?: string;
    currentEstado?: string;
    isCreate: boolean;
  }) {
    if (input.montoContrato <= 0) {
      throw new BadRequestException(
        'montoContrato debe ser mayor que cero.',
      );
    }

    const fechaEmision = input.fechaEmision
      ? new Date(input.fechaEmision)
      : new Date();
    const fechaFirma = input.fechaFirma ? new Date(input.fechaFirma) : undefined;
    const fechaVencimiento = input.fechaVencimiento
      ? new Date(input.fechaVencimiento)
      : undefined;

    if (Number.isNaN(fechaEmision.getTime())) {
      throw new BadRequestException('fechaEmision no es una fecha válida.');
    }

    if (fechaFirma && Number.isNaN(fechaFirma.getTime())) {
      throw new BadRequestException('fechaFirma no es una fecha válida.');
    }

    if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
      throw new BadRequestException('fechaVencimiento no es una fecha válida.');
    }

    if (fechaFirma && fechaFirma.getTime() < fechaEmision.getTime()) {
      throw new BadRequestException(
        'fechaFirma no puede ser anterior a fechaEmision.',
      );
    }

    if (
      fechaVencimiento &&
      fechaVencimiento.getTime() < fechaEmision.getTime()
    ) {
      throw new BadRequestException(
        'fechaVencimiento no puede ser anterior a fechaEmision.',
      );
    }

    if (input.estado === 'FIRMADO' && !input.fechaFirma) {
      throw new BadRequestException(
        'fechaFirma es obligatoria cuando el contrato está FIRMADO.',
      );
    }

    if (input.estado === 'VENCIDO' && !input.fechaVencimiento) {
      throw new BadRequestException(
        'fechaVencimiento es obligatoria cuando el contrato está VENCIDO.',
      );
    }

    if (!input.isCreate && input.currentEstado) {
      const allowedTransitions: Record<string, string[]> = {
        BORRADOR: ['BORRADOR', 'PENDIENTE_FIRMA', 'ANULADO'],
        PENDIENTE_FIRMA: ['PENDIENTE_FIRMA', 'FIRMADO', 'VENCIDO', 'ANULADO'],
        FIRMADO: ['FIRMADO', 'VENCIDO', 'ANULADO'],
        VENCIDO: ['VENCIDO', 'ANULADO'],
        ANULADO: ['ANULADO'],
      };

      if (!allowedTransitions[input.currentEstado]?.includes(input.estado)) {
        throw new BadRequestException(
          `No se permite cambiar el estado de ${input.currentEstado} a ${input.estado}.`,
        );
      }
    }
  }

  private async ensureVentaDisponible(empresaId: string, ventaId: string) {
    const venta = await this.prisma.venta.findFirst({
      where: {
        id: ventaId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: {
        id: true,
        estado: true,
        clienteId: true,
        propiedadId: true,
        asesorId: true,
      },
    });

    if (!venta) {
      throw new NotFoundException('Venta no encontrada para la empresa indicada.');
    }

    return venta;
  }

  private async ensureClienteDisponible(empresaId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id: clienteId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!cliente) {
      throw new NotFoundException(
        'Cliente no encontrado para la empresa indicada.',
      );
    }
  }

  private async ensurePropiedadDisponible(empresaId: string, propiedadId: string) {
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
      select: { id: true },
    });

    if (!propiedad) {
      throw new NotFoundException(
        'Propiedad no encontrada para la empresa indicada.',
      );
    }
  }

  private async ensureResponsableDisponible(
    empresaId: string,
    responsableId: string,
  ) {
    const responsable = await this.prisma.usuario.findFirst({
      where: {
        id: responsableId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!responsable) {
      throw new NotFoundException(
        'Responsable no encontrado para la empresa indicada.',
      );
    }
  }

  private async ensureNoActiveContractForVenta(ventaId: string, excludeId?: string) {
    const existing = await this.prisma.contrato.findFirst({
      where: {
        ventaId,
        active: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un contrato activo para la venta indicada.',
      );
    }
  }

  private async ensureUniqueContractVersion(
    empresaId: string,
    numeroContrato: string,
    version: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.contrato.findFirst({
      where: {
        empresaId,
        numeroContrato,
        version,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un contrato con el mismo número y versión en la empresa.',
      );
    }
  }

  private defaultInclude(): Prisma.ContratoInclude {
    return {
      venta: {
        select: {
          id: true,
          estado: true,
          fechaVenta: true,
          totalVenta: true,
          saldoPendiente: true,
        },
      },
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
      responsable: {
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

