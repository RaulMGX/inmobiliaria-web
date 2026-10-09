import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { FindPipelineQueryDto } from './dto/find-pipeline.query.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreatePipelineDto) {
    this.validateBusinessRules(dto);
    await Promise.all([
      this.ensureClienteDisponible(empresaId, dto.clienteId),
      this.ensureAsesorDisponible(empresaId, dto.asesorId),
    ]);

    return this.prisma.pipelineComercial.create({
      data: this.buildCreateData(empresaId, dto),
      include: this.defaultInclude(),
    });
  }

  async findAll(empresaId: string, query: FindPipelineQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pipelineComercial.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.defaultInclude(),
      }),
      this.prisma.pipelineComercial.count({ where }),
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
    const pipeline = await this.prisma.pipelineComercial.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!pipeline) {
      throw new NotFoundException(
        'Oportunidad comercial no encontrada para la empresa indicada.',
      );
    }

    return pipeline;
  }

  async update(empresaId: string, id: string, dto: UpdatePipelineDto) {
    const current = await this.findOne(empresaId, id);
    const merged = {
      etapa: dto.etapa ?? current.etapa,
      fechaIngreso: dto.fechaIngreso ?? current.fechaIngreso.toISOString(),
      fechaUltimoSeguimiento:
        dto.fechaUltimoSeguimiento ??
        current.fechaUltimoSeguimiento?.toISOString(),
      proximaFechaSeguimiento:
        dto.proximaFechaSeguimiento ??
        current.proximaFechaSeguimiento?.toISOString(),
      motivoPerdida: dto.motivoPerdida ?? current.motivoPerdida ?? undefined,
    };

    this.validateBusinessRules(merged);

    if (dto.clienteId) {
      await this.ensureClienteDisponible(empresaId, dto.clienteId);
    }

    if (dto.asesorId) {
      await this.ensureAsesorDisponible(empresaId, dto.asesorId);
    }

    return this.prisma.pipelineComercial.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: this.defaultInclude(),
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.pipelineComercial.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindPipelineQueryDto,
  ): Prisma.PipelineComercialWhereInput {
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
    const containsPipeline = (
      value: string,
    ): Prisma.StringFilter<'PipelineComercial'> => ({
      contains: value,
      mode: 'insensitive',
    });

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.etapa ? { etapa: query.etapa as any } : {}),
      ...(query.prioridad ? { prioridad: query.prioridad as any } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.asesorId ? { asesorId: query.asesorId } : {}),
      ...(query.vencidas === true
        ? {
            proximaFechaSeguimiento: {
              lt: now,
            },
          }
        : {}),
      ...(query.vencidas === false
        ? {
            OR: [
              { proximaFechaSeguimiento: null },
              { proximaFechaSeguimiento: { gte: now } },
            ],
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: <Prisma.PipelineComercialWhereInput[]>[
                  {
                    cliente: {
                      nombres: containsCliente(search),
                    },
                  },
                  {
                    cliente: {
                      apellidos: containsCliente(search),
                    },
                  },
                  {
                    cliente: {
                      correo: containsCliente(search),
                    },
                  },
                  {
                    cliente: {
                      numeroDocumento: containsCliente(search),
                    },
                  },
                  {
                    asesor: {
                      nombres: containsUsuario(search),
                    },
                  },
                  {
                    asesor: {
                      apellidos: containsUsuario(search),
                    },
                  },
                  { motivoPerdida: containsPipeline(search) },
                  { observaciones: containsPipeline(search) },
                ],
              },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    query: FindPipelineQueryDto,
  ): Prisma.PipelineComercialOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';
    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreatePipelineDto,
  ): Prisma.PipelineComercialCreateInput {
    return {
      ...this.normalizePayload(dto),
      empresaId,
      clienteId: dto.clienteId,
      asesorId: dto.asesorId,
    } as unknown as Prisma.PipelineComercialCreateInput;
  }

  private buildUpdateData(
    dto: UpdatePipelineDto,
  ): Prisma.PipelineComercialUpdateInput {
    return {
      ...this.normalizePayload(dto),
      ...(dto.clienteId ? { clienteId: dto.clienteId } : {}),
      ...(dto.asesorId ? { asesorId: dto.asesorId } : {}),
    } as unknown as Prisma.PipelineComercialUpdateInput;
  }

  private normalizePayload(dto: Partial<CreatePipelineDto>) {
    return {
      ...(dto.etapa !== undefined ? { etapa: dto.etapa as any } : {}),
      ...(dto.fechaIngreso !== undefined
        ? { fechaIngreso: dto.fechaIngreso ? new Date(dto.fechaIngreso) : undefined }
        : {}),
      ...(dto.fechaUltimoSeguimiento !== undefined
        ? {
            fechaUltimoSeguimiento: dto.fechaUltimoSeguimiento
              ? new Date(dto.fechaUltimoSeguimiento)
              : null,
          }
        : {}),
      ...(dto.proximaFechaSeguimiento !== undefined
        ? {
            proximaFechaSeguimiento: dto.proximaFechaSeguimiento
              ? new Date(dto.proximaFechaSeguimiento)
              : null,
          }
        : {}),
      ...(dto.prioridad !== undefined ? { prioridad: dto.prioridad as any } : {}),
      ...(dto.probabilidadCierre !== undefined
        ? { probabilidadCierre: dto.probabilidadCierre }
        : {}),
      ...(dto.motivoPerdida !== undefined
        ? { motivoPerdida: dto.motivoPerdida?.trim() || null }
        : {}),
      ...(dto.observaciones !== undefined
        ? { observaciones: dto.observaciones?.trim() || null }
        : {}),
    };
  }

  private validateBusinessRules(dto: {
    etapa?: string;
    fechaIngreso?: string;
    fechaUltimoSeguimiento?: string;
    proximaFechaSeguimiento?: string;
    motivoPerdida?: string;
  }) {
    const fechaIngreso = dto.fechaIngreso ? new Date(dto.fechaIngreso) : undefined;
    const fechaUltimo = dto.fechaUltimoSeguimiento
      ? new Date(dto.fechaUltimoSeguimiento)
      : undefined;
    const proximaFecha = dto.proximaFechaSeguimiento
      ? new Date(dto.proximaFechaSeguimiento)
      : undefined;

    if (
      fechaIngreso &&
      proximaFecha &&
      proximaFecha.getTime() < fechaIngreso.getTime()
    ) {
      throw new BadRequestException(
        'proximaFechaSeguimiento no puede ser anterior a fechaIngreso.',
      );
    }

    if (
      fechaIngreso &&
      fechaUltimo &&
      fechaUltimo.getTime() < fechaIngreso.getTime()
    ) {
      throw new BadRequestException(
        'fechaUltimoSeguimiento no puede ser anterior a fechaIngreso.',
      );
    }

    if (
      dto.etapa === 'VENTA_PERDIDA' &&
      (!dto.motivoPerdida || dto.motivoPerdida.trim() === '')
    ) {
      throw new BadRequestException(
        'motivoPerdida es obligatorio cuando la etapa es VENTA_PERDIDA.',
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

  private defaultInclude(): Prisma.PipelineComercialInclude {
    return {
      cliente: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
          celular: true,
          estado: true,
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
}

