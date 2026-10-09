import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { FindReservasQueryDto } from './dto/find-reservas.query.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';

@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateReservaDto) {
    const estado = dto.estado ?? 'ACTIVA';
    this.validateBusinessRules({
      estado,
      montoSeparacion: dto.montoSeparacion,
      fechaReserva: dto.fechaReserva,
      fechaVencimiento: dto.fechaVencimiento,
      isCreate: true,
    });

    await Promise.all([
      this.ensureClienteDisponible(empresaId, dto.clienteId),
      this.ensureAsesorDisponible(empresaId, dto.asesorId),
      this.ensurePropiedadReservable(empresaId, dto.propiedadId),
      dto.pipelineId
        ? this.ensurePipelineDisponible(empresaId, dto.pipelineId)
        : Promise.resolve(),
      dto.visitaId ? this.ensureVisitaDisponible(empresaId, dto.visitaId) : Promise.resolve(),
      dto.visitaId
        ? this.ensureVisitaNoReservada(dto.visitaId)
        : Promise.resolve(),
      estado === 'ACTIVA'
        ? this.ensureNoActiveReservationForProperty(empresaId, dto.propiedadId)
        : Promise.resolve(),
    ]);

    return this.prisma.reserva.create({
      data: this.buildCreateData(empresaId, dto),
      include: this.defaultInclude(),
    });
  }

  async findAll(empresaId: string, query: FindReservasQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.reserva.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.reserva.count({ where }),
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
    const reserva = await this.prisma.reserva.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!reserva) {
      throw new NotFoundException(
        'Reserva no encontrada para la empresa indicada.',
      );
    }

    return reserva;
  }

  async update(empresaId: string, id: string, dto: UpdateReservaDto) {
    const current = await this.findOne(empresaId, id);

    const nextState = dto.estado ?? current.estado;
    const nextPropertyId = dto.propiedadId ?? current.propiedadId;
    const nextVisitaId =
      dto.visitaId !== undefined ? dto.visitaId : current.visitaId ?? undefined;

    this.validateBusinessRules({
      estado: nextState,
      montoSeparacion: dto.montoSeparacion ?? Number(current.montoSeparacion),
      fechaReserva: dto.fechaReserva ?? current.fechaReserva.toISOString(),
      fechaVencimiento:
        dto.fechaVencimiento ?? current.fechaVencimiento.toISOString(),
      currentEstado: current.estado,
      isCreate: false,
    });

    await Promise.all([
      dto.clienteId
        ? this.ensureClienteDisponible(empresaId, dto.clienteId)
        : Promise.resolve(),
      dto.asesorId
        ? this.ensureAsesorDisponible(empresaId, dto.asesorId)
        : Promise.resolve(),
      dto.propiedadId
        ? this.ensurePropiedadDisponible(empresaId, dto.propiedadId)
        : Promise.resolve(),
      dto.pipelineId
        ? this.ensurePipelineDisponible(empresaId, dto.pipelineId)
        : Promise.resolve(),
      nextVisitaId
        ? this.ensureVisitaDisponible(empresaId, nextVisitaId)
        : Promise.resolve(),
      nextVisitaId
        ? this.ensureVisitaNoReservada(nextVisitaId, id)
        : Promise.resolve(),
      nextState === 'ACTIVA'
        ? this.ensureNoActiveReservationForProperty(empresaId, nextPropertyId, id)
        : Promise.resolve(),
      dto.propiedadId
        ? this.ensurePropertyStateForReservation(empresaId, dto.propiedadId)
        : Promise.resolve(),
    ]);

    return this.prisma.reserva.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: this.defaultInclude(),
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.reserva.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindReservasQueryDto,
  ): Prisma.ReservaWhereInput {
    const search = query.search?.trim();
    const now = new Date();
    const containsCliente = (
      value: string,
    ): Prisma.StringFilter<'Cliente'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsUsuario = (
      value: string,
    ): Prisma.StringFilter<'Usuario'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsPropiedad = (
      value: string,
    ): Prisma.StringFilter<'Propiedad'> => ({
      contains: value,
      mode: 'insensitive',
    });
    const containsReserva = (
      value: string,
    ): Prisma.StringFilter<'Reserva'> => ({
      contains: value,
      mode: 'insensitive',
    });

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado as any } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.propiedadId ? { propiedadId: query.propiedadId } : {}),
      ...(query.asesorId ? { asesorId: query.asesorId } : {}),
      ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
      ...(query.visitaId ? { visitaId: query.visitaId } : {}),
      ...(query.vencidas === true
        ? {
            fechaVencimiento: { lt: now },
          }
        : {}),
      ...(query.vencidas === false
        ? {
            fechaVencimiento: { gte: now },
          }
        : {}),
      ...(search
        ? {
            OR: <Prisma.ReservaWhereInput[]>[
              { cliente: { nombres: containsCliente(search) } },
              { cliente: { apellidos: containsCliente(search) } },
              { cliente: { numeroDocumento: containsCliente(search) } },
              { propiedad: { nombre: containsPropiedad(search) } },
              { propiedad: { codigoInterno: containsPropiedad(search) } },
              { asesor: { nombres: containsUsuario(search) } },
              { asesor: { apellidos: containsUsuario(search) } },
              { observaciones: containsReserva(search) },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindReservasQueryDto,
  ): Prisma.ReservaOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'fechaReserva';
    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreateReservaDto,
  ): Prisma.ReservaCreateInput {
    return {
      ...this.normalizePayload(dto),
      empresaId,
      clienteId: dto.clienteId,
      propiedadId: dto.propiedadId,
      asesorId: dto.asesorId,
      ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
      ...(dto.visitaId ? { visitaId: dto.visitaId } : {}),
    } as unknown as Prisma.ReservaCreateInput;
  }

  private buildUpdateData(dto: UpdateReservaDto): Prisma.ReservaUpdateInput {
    return {
      ...this.normalizePayload(dto),
      ...(dto.clienteId ? { clienteId: dto.clienteId } : {}),
      ...(dto.propiedadId ? { propiedadId: dto.propiedadId } : {}),
      ...(dto.asesorId ? { asesorId: dto.asesorId } : {}),
      ...(dto.pipelineId !== undefined
        ? { pipelineId: dto.pipelineId || null }
        : {}),
      ...(dto.visitaId !== undefined
        ? { visitaId: dto.visitaId || null }
        : {}),
    } as unknown as Prisma.ReservaUpdateInput;
  }

  private normalizePayload(dto: Partial<CreateReservaDto>) {
    return {
      ...(dto.estado !== undefined ? { estado: dto.estado as any } : {}),
      ...(dto.montoSeparacion !== undefined
        ? { montoSeparacion: dto.montoSeparacion }
        : {}),
      ...(dto.fechaReserva !== undefined
        ? { fechaReserva: new Date(dto.fechaReserva) }
        : {}),
      ...(dto.fechaVencimiento !== undefined
        ? { fechaVencimiento: new Date(dto.fechaVencimiento) }
        : {}),
      ...(dto.observaciones !== undefined
        ? { observaciones: dto.observaciones?.trim() || null }
        : {}),
    };
  }

  private validateBusinessRules(input: {
    estado: string;
    montoSeparacion: number;
    fechaReserva?: string;
    fechaVencimiento: string;
    currentEstado?: string;
    isCreate: boolean;
  }) {
    const fechaReserva = input.fechaReserva
      ? new Date(input.fechaReserva)
      : new Date();
    const fechaVencimiento = new Date(input.fechaVencimiento);

    if (Number.isNaN(fechaReserva.getTime())) {
      throw new BadRequestException('fechaReserva no es una fecha válida.');
    }

    if (Number.isNaN(fechaVencimiento.getTime())) {
      throw new BadRequestException('fechaVencimiento no es una fecha válida.');
    }

    if (input.montoSeparacion < 0) {
      throw new BadRequestException(
        'montoSeparacion no puede ser negativo.',
      );
    }

    if (fechaVencimiento.getTime() < fechaReserva.getTime()) {
      throw new BadRequestException(
        'fechaVencimiento no puede ser anterior a fechaReserva.',
      );
    }

    if (input.isCreate && input.estado !== 'ACTIVA') {
      throw new BadRequestException(
        'Una reserva solo puede crearse inicialmente en estado ACTIVA.',
      );
    }

    if (!input.isCreate && input.currentEstado) {
      const allowedTransitions: Record<string, string[]> = {
        ACTIVA: ['ACTIVA', 'VENCIDA', 'CANCELADA', 'CONVERTIDA'],
        VENCIDA: ['VENCIDA'],
        CANCELADA: ['CANCELADA'],
        CONVERTIDA: ['CONVERTIDA'],
      };

      if (!allowedTransitions[input.currentEstado]?.includes(input.estado)) {
        throw new BadRequestException(
          `No se permite cambiar el estado de ${input.currentEstado} a ${input.estado}.`,
        );
      }
    }
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

  private async ensureAsesorDisponible(empresaId: string, asesorId: string) {
    const asesor = await this.prisma.usuario.findFirst({
      where: {
        id: asesorId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!asesor) {
      throw new NotFoundException(
        'Asesor no encontrado para la empresa indicada.',
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
      select: { id: true, estado: true },
    });

    if (!propiedad) {
      throw new NotFoundException(
        'Propiedad no encontrada para la empresa indicada.',
      );
    }
  }

  private async ensurePropertyStateForReservation(
    empresaId: string,
    propiedadId: string,
  ) {
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
      throw new NotFoundException(
        'Propiedad no encontrada para la empresa indicada.',
      );
    }

    if (propiedad.estado !== 'DISPONIBLE') {
      throw new ConflictException(
        'La propiedad no está disponible para generar una reserva.',
      );
    }
  }

  private async ensurePropiedadReservable(empresaId: string, propiedadId: string) {
    await this.ensurePropertyStateForReservation(empresaId, propiedadId);
  }

  private async ensurePipelineDisponible(empresaId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipelineComercial.findFirst({
      where: {
        id: pipelineId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!pipeline) {
      throw new NotFoundException(
        'Pipeline comercial no encontrado para la empresa indicada.',
      );
    }
  }

  private async ensureVisitaDisponible(empresaId: string, visitaId: string) {
    const visita = await this.prisma.visitaPropiedad.findFirst({
      where: {
        id: visitaId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!visita) {
      throw new NotFoundException(
        'Visita no encontrada para la empresa indicada.',
      );
    }
  }

  private async ensureVisitaNoReservada(visitaId: string, excludeId?: string) {
    const existing = await this.prisma.reserva.findFirst({
      where: {
        visitaId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'La visita indicada ya está vinculada a otra reserva.',
      );
    }
  }

  private async ensureNoActiveReservationForProperty(
    empresaId: string,
    propiedadId: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.reserva.findFirst({
      where: {
        empresaId,
        propiedadId,
        estado: 'ACTIVA',
        active: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'La propiedad ya tiene una reserva activa registrada.',
      );
    }
  }

  private defaultInclude(): Prisma.ReservaInclude {
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
      asesor: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
        },
      },
      pipeline: {
        select: {
          id: true,
          etapa: true,
          prioridad: true,
        },
      },
      visita: {
        select: {
          id: true,
          fechaHora: true,
          estado: true,
        },
      },
    };
  }
}

