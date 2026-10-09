import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { FindVisitasQueryDto } from './dto/find-visitas.query.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';

@Injectable()
export class VisitasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateVisitaDto) {
    this.validateBusinessRules(dto);

    await Promise.all([
      this.ensureClienteDisponible(empresaId, dto.clienteId),
      this.ensureAsesorDisponible(empresaId, dto.asesorId),
      this.ensurePropiedadDisponible(empresaId, dto.propiedadId),
      dto.pipelineId
        ? this.ensurePipelineDisponible(empresaId, dto.pipelineId)
        : Promise.resolve(),
      dto.seguimientoId
        ? this.ensureSeguimientoDisponible(empresaId, dto.seguimientoId)
        : Promise.resolve(),
      dto.reprogramadaDeId
        ? this.ensureVisitaDisponible(empresaId, dto.reprogramadaDeId)
        : Promise.resolve(),
    ]);

    return this.prisma.visitaPropiedad.create({
      data: this.buildCreateData(empresaId, dto),
      include: this.defaultInclude(),
    });
  }

  async findAll(empresaId: string, query: FindVisitasQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.visitaPropiedad.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.visitaPropiedad.count({ where }),
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
    const visita = await this.prisma.visitaPropiedad.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!visita) {
      throw new NotFoundException(
        'Visita no encontrada para la empresa indicada.',
      );
    }

    return visita;
  }

  async update(empresaId: string, id: string, dto: UpdateVisitaDto) {
    const current = await this.findOne(empresaId, id);
    const merged = {
      fechaHora: dto.fechaHora ?? current.fechaHora.toISOString(),
      duracionEstimada: dto.duracionEstimada ?? current.duracionEstimada ?? undefined,
      estado: dto.estado ?? current.estado,
      reprogramadaDeId: dto.reprogramadaDeId ?? current.reprogramadaDeId ?? undefined,
    };

    this.validateBusinessRules(merged, id);

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
      dto.seguimientoId
        ? this.ensureSeguimientoDisponible(empresaId, dto.seguimientoId)
        : Promise.resolve(),
      dto.reprogramadaDeId
        ? this.ensureVisitaDisponible(empresaId, dto.reprogramadaDeId)
        : Promise.resolve(),
    ]);

    return this.prisma.visitaPropiedad.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: this.defaultInclude(),
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.visitaPropiedad.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindVisitasQueryDto,
  ): Prisma.VisitaPropiedadWhereInput {
    const search = query.search?.trim();
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
    const containsVisita = (
      value: string,
    ): Prisma.StringFilter<'VisitaPropiedad'> => ({
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
      ...(query.seguimientoId ? { seguimientoId: query.seguimientoId } : {}),
      ...(search
        ? {
            OR: <Prisma.VisitaPropiedadWhereInput[]>[
              { cliente: { nombres: containsCliente(search) } },
              { cliente: { apellidos: containsCliente(search) } },
              { asesor: { nombres: containsUsuario(search) } },
              { asesor: { apellidos: containsUsuario(search) } },
              { propiedad: { nombre: containsPropiedad(search) } },
              { propiedad: { codigoInterno: containsPropiedad(search) } },
              { lugarEncuentro: containsVisita(search) },
              { resultado: containsVisita(search) },
              { observaciones: containsVisita(search) },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindVisitasQueryDto,
  ): Prisma.VisitaPropiedadOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'fechaHora';
    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreateVisitaDto,
  ): Prisma.VisitaPropiedadCreateInput {
    return {
      ...this.normalizePayload(dto),
      empresaId,
      clienteId: dto.clienteId,
      asesorId: dto.asesorId,
      propiedadId: dto.propiedadId,
      ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
      ...(dto.seguimientoId ? { seguimientoId: dto.seguimientoId } : {}),
      ...(dto.reprogramadaDeId ? { reprogramadaDeId: dto.reprogramadaDeId } : {}),
    } as unknown as Prisma.VisitaPropiedadCreateInput;
  }

  private buildUpdateData(dto: UpdateVisitaDto): Prisma.VisitaPropiedadUpdateInput {
    return {
      ...this.normalizePayload(dto),
      ...(dto.clienteId ? { clienteId: dto.clienteId } : {}),
      ...(dto.asesorId ? { asesorId: dto.asesorId } : {}),
      ...(dto.propiedadId ? { propiedadId: dto.propiedadId } : {}),
      ...(dto.pipelineId !== undefined
        ? { pipelineId: dto.pipelineId || null }
        : {}),
      ...(dto.seguimientoId !== undefined
        ? { seguimientoId: dto.seguimientoId || null }
        : {}),
      ...(dto.reprogramadaDeId !== undefined
        ? { reprogramadaDeId: dto.reprogramadaDeId || null }
        : {}),
    } as unknown as Prisma.VisitaPropiedadUpdateInput;
  }

  private normalizePayload(dto: Partial<CreateVisitaDto>) {
    return {
      ...(dto.fechaHora !== undefined
        ? { fechaHora: new Date(dto.fechaHora) }
        : {}),
      ...(dto.duracionEstimada !== undefined
        ? { duracionEstimada: dto.duracionEstimada ?? null }
        : {}),
      ...(dto.lugarEncuentro !== undefined
        ? { lugarEncuentro: dto.lugarEncuentro?.trim() || null }
        : {}),
      ...(dto.estado !== undefined ? { estado: dto.estado as any } : {}),
      ...(dto.resultado !== undefined ? { resultado: dto.resultado?.trim() || null } : {}),
      ...(dto.observaciones !== undefined
        ? { observaciones: dto.observaciones?.trim() || null }
        : {}),
    };
  }

  private validateBusinessRules(
    dto: {
      fechaHora?: string;
      duracionEstimada?: number;
      estado?: string;
      reprogramadaDeId?: string;
    },
    currentId?: string,
  ) {
    if (dto.fechaHora && Number.isNaN(new Date(dto.fechaHora).getTime())) {
      throw new BadRequestException('fechaHora no es una fecha válida.');
    }

    if (
      dto.duracionEstimada !== undefined &&
      dto.duracionEstimada !== null &&
      dto.duracionEstimada < 0
    ) {
      throw new BadRequestException(
        'duracionEstimada no puede ser negativa.',
      );
    }

    if (dto.estado === 'REPROGRAMADA' && !dto.reprogramadaDeId) {
      throw new BadRequestException(
        'reprogramadaDeId es obligatorio cuando el estado es REPROGRAMADA.',
      );
    }

    if (currentId && dto.reprogramadaDeId && dto.reprogramadaDeId === currentId) {
      throw new BadRequestException(
        'Una visita no puede referenciarse a sí misma como reprogramación.',
      );
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
      select: { id: true },
    });

    if (!propiedad) {
      throw new NotFoundException(
        'Propiedad no encontrada para la empresa indicada.',
      );
    }
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

  private async ensureSeguimientoDisponible(
    empresaId: string,
    seguimientoId: string,
  ) {
    const seguimiento = await this.prisma.seguimientoAgenda.findFirst({
      where: {
        id: seguimientoId,
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!seguimiento) {
      throw new NotFoundException(
        'Seguimiento no encontrado para la empresa indicada.',
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
        'Visita de referencia no encontrada para la empresa indicada.',
      );
    }
  }

  private defaultInclude(): Prisma.VisitaPropiedadInclude {
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
          estado: true,
          proyecto: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },
      pipeline: {
        select: {
          id: true,
          etapa: true,
          prioridad: true,
        },
      },
      seguimiento: {
        select: {
          id: true,
          fechaProgramada: true,
          estado: true,
          tipo: true,
        },
      },
      reprogramadaDe: {
        select: {
          id: true,
          fechaHora: true,
          estado: true,
        },
      },
    };
  }
}

